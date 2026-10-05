<?php

declare(strict_types=1);

use Illuminate\Auth\Access\Gate;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Auth\Access\Gate as GateContract;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory;
use Nexia\Apps\Nexia\SubmissionProof\Http\Controllers\NoteController;
use Nexia\Apps\Nexia\SubmissionProof\Models\Note;
use Nexia\Apps\Nexia\SubmissionProof\Policies\NotePolicy;
use Nexia\Identity\Contracts\Actor;
use Nexia\Laravel\Access\Contracts\PermissionAuthorizer;
use Nexia\Laravel\Access\Contracts\ResourceActionDecisions;
use Nexia\Laravel\Access\Contracts\ResourceAuthorization;
use Nexia\Laravel\Access\PermissionAuthorizerResolver;
use Nexia\Laravel\Database\AppDatabaseConnectionsResolver;
use Nexia\Laravel\Database\Contracts\AppDatabaseConnections;

// Real controller/model/validation and SQLite persistence; host services use SDK contracts.
// Activity logging uses the installed dependency; external search indexing is disabled.
test('authorized Note writes persist, validate, serialize and soft delete', function () {
    $previous = \Illuminate\Container\Container::getInstance();
    $app = new Application(dirname(__DIR__, 2));
    $app->instance('config', new Repository(['scout' => ['driver' => 'database'], 'app' => ['key' => 'testing']]));
    Facade::setFacadeApplication($app);
    $translator = new Translator(new ArrayLoader, 'en');
    $app->instance('translator', $translator);
    $validation = new Factory($translator, $app);
    Request::macro('validate', fn (array $rules) => $validation->make($this->all(), $rules)->validate());
    $responses = $this->createStub(\Illuminate\Contracts\Routing\ResponseFactory::class);
    $responses->method('json')->willReturnCallback(fn ($data, $status = 200) => new \Illuminate\Http\JsonResponse($data, $status));
    $app->instance(\Illuminate\Contracts\Routing\ResponseFactory::class, $responses);
    $db = new Capsule($app);
    $db->addConnection(['driver' => 'sqlite', 'database' => ':memory:']);
    $db->setEventDispatcher(new \Illuminate\Events\Dispatcher($app));
    $db->bootEloquent();
    $app->instance('events', $db->getEventDispatcher());
    $app->instance('auth', new \Illuminate\Auth\AuthManager($app));
    $app->register(\Spatie\Activitylog\ActivitylogServiceProvider::class);
    $app->make(\Spatie\Activitylog\Support\CauserResolver::class)->resolveUsing(fn () => null);
    \Laravel\Scout\ModelObserver::disableSyncingFor(Note::class);
    $app->instance('db', $db->getDatabaseManager());
    $app->bind('db.schema', fn () => $db->getConnection()->getSchemaBuilder());
    $connections = $this->createStub(AppDatabaseConnections::class);
    $connections->method('modelConnectionName')->willReturn('default');
    AppDatabaseConnectionsResolver::configure(fn () => $connections);
    $actor = $this->createMockForIntersectionOfInterfaces([Actor::class, Authenticatable::class]);
    $permission = $this->createStub(PermissionAuthorizer::class);
    $permission->method('allowsPermission')->willReturn(true);
    PermissionAuthorizerResolver::configure($permission);
    $ownership = $this->createStub(ResourceAuthorization::class);
    $ownership->method('recordMatches')->willReturn(true);
    $ownership->method('scopeVisible')->willReturnCallback(fn ($query) => $query);
    $ownership->method('creationAttributes')->willReturn([]);
    $app->instance(ResourceAuthorization::class, $ownership);
    $actions = $this->createStub(ResourceActionDecisions::class);
    $actions->method('forCollection')->willReturn(['create' => true]);
    $transferCatalog = $this->createStub(\Nexia\ResourceTransfer\Contracts\ResourceTransferCatalog::class);
    $app->instance(\Nexia\ResourceTransfer\Contracts\ResourceTransferCatalog::class, $transferCatalog);
    $actions->method('forRecord')->willReturn(['view' => true, 'update' => true, 'delete' => true, 'restore' => false]);
    $app->instance(ResourceActionDecisions::class, $actions);
    $gate = new Gate($app, fn () => $actor);
    $gate->policy(Note::class, NotePolicy::class);
    $app->instance(GateContract::class, $gate);
    $request = function (array $input) use ($actor) {
        $request = Request::create('/notes', 'POST', $input);
        $request->setUserResolver(fn () => $actor);
        return $request;
    };
    try {
        (require dirname(__DIR__, 2).'/database/migrations/tenant/2026_10_05_002106_create_submission_proof_notes_table.php')->up();
        (require \Composer\InstalledVersions::getInstallPath('spatie/laravel-activitylog').'/database/migrations/create_activity_log_table.php.stub')->up();
        (function () use ($request, $db, $app, $permission, $gate) {
            $controller = new NoteController;
            foreach ([[], ['name' => ''], ['name' => str_repeat('x', 256)]] as $invalid) {
                expect(fn () => $controller->store($request($invalid)))->toThrow(\Illuminate\Validation\ValidationException::class);
            }
            $created = $controller->store($request(['name' => 'Saved note']));
            expect($created->getStatusCode())->toBe(201);
            $data = $created->getData(true)['note'];
            expect($data)->not->toHaveKeys(['id', 'legal_entity_id']);
            $id = $data['public_id'];
            expect(Note::where('public_id', $id)->firstOrFail()->name)->toBe('Saved note');
            foreach (['', str_repeat('x', 256)] as $invalid) {
                expect(fn () => $controller->update($request(['name' => $invalid]), $id))->toThrow(\Illuminate\Validation\ValidationException::class);
            }
            $updated = $controller->update($request(['name' => 'Updated note']), $id);
            expect($updated->getStatusCode())->toBe(200)
                ->and($updated->getData(true)['note']['name'])->toBe('Updated note')
                ->and($controller->update($request([]), $id)->getData(true)['note']['name'])->toBe('Updated note')
                ->and($controller->show($request([]), $id)->getData(true)['note']['name'])->toBe('Updated note');
            // Tenant-shared read visibility is intentional for two distinct authorized actors.
            foreach ([101, 202] as $actorId) {
                $reader = $this->createMockForIntersectionOfInterfaces([Actor::class, Authenticatable::class]);
                $reader->method('key')->willReturn($actorId);
                $read = Request::create('/notes', 'GET');
                $read->setUserResolver(fn () => $reader);
                $app->instance(GateContract::class, $gate->forUser($reader));
                $list = $controller->index($read)->getData(true);
                expect($list['meta']['total'])->toBe(1)
                    ->and($list['data'][0]['public_id'])->toBe($id)
                    ->and($list['data'][0])->not->toHaveKeys(['id', 'legal_entity_id'])
                    ->and($controller->collectionActions($read)->getData(true))->toBe(['meta' => ['actions' => ['create' => true]]]);
            }
            $app->instance(GateContract::class, $gate);
            // Two stale editors saving sequentially demonstrate the declared last-writer-wins contract.
            $controller->update($request(['name' => 'First editor']), $id);
            $controller->update($request(['name' => 'Updated note']), $id);
            expect(Note::where('public_id', $id)->firstOrFail()->name)->toBe('Updated note');
            expect($controller->destroy($request([]), $id)->getStatusCode())->toBe(200)
                ->and(Note::where('public_id', $id)->exists())->toBeFalse()
                ->and(Note::withTrashed()->where('public_id', $id)->firstOrFail()->trashed())->toBeTrue();
            expect(fn () => $controller->show($request([]), $id))->toThrow(\Illuminate\Database\Eloquent\ModelNotFoundException::class);
            $denied = $this->createStub(PermissionAuthorizer::class);
            $denied->method('allowsPermission')->willReturn(false);
            PermissionAuthorizerResolver::configure($denied);
            expect(fn () => $controller->restore($request([]), $id))->toThrow(\Illuminate\Auth\Access\AuthorizationException::class);
            expect(Note::withTrashed()->where('public_id', $id)->firstOrFail()->trashed())->toBeTrue();
            PermissionAuthorizerResolver::configure($permission);
            expect($controller->restore($request([]), $id)->getStatusCode())->toBe(200)
                ->and(Note::where('public_id', $id)->firstOrFail()->name)->toBe('Updated note');
            expect($db->getConnection()->table('activity_log')->pluck('event')->all())->toContain('created', 'updated', 'deleted', 'restored');
        })();
    } finally {
        PermissionAuthorizerResolver::resetForTests();
        Model::clearBootedModels();
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        \Illuminate\Container\Container::setInstance($previous);
    }
});
