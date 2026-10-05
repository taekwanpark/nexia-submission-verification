<?php

declare(strict_types=1);

use Illuminate\Container\Container;
use Illuminate\Contracts\Auth\Authenticatable;
use Nexia\Apps\Nexia\SubmissionProof\Models\Note;
use Nexia\Apps\Nexia\SubmissionProof\Policies\NotePolicy;
use Nexia\Identity\Contracts\Actor;
use Nexia\Laravel\Access\Contracts\PermissionAuthorizer;
use Nexia\Laravel\Access\Contracts\ResourceAuthorization;
use Nexia\Laravel\Access\PermissionAuthorizerResolver;

// Exercise the real policy against the SDK boundary; no Core internals or DB required.
test('record actions require their exact permission and a matching tenant record', function (string $action, string $permission) {
    $actor = $this->createMockForIntersectionOfInterfaces([Actor::class, Authenticatable::class]);
    $record = $this->getMockBuilder(Note::class)->disableOriginalConstructor()->getMock();
    $policy = new NotePolicy;
    $previousContainer = Container::getInstance();
    $container = new Container;
    Container::setInstance($container);

    try {
        foreach ([[false, true, false], [true, false, false], [true, true, true]] as [$granted, $matches, $expected]) {
            $permissions = $this->createMock(PermissionAuthorizer::class);
            $permissions->expects($this->once())->method('allowsPermission')
                ->with($actor, $permission, null, null, true)->willReturn($granted);
            PermissionAuthorizerResolver::configure($permissions);
            $authorization = $this->createMock(ResourceAuthorization::class);
            $authorization->expects($granted ? $this->once() : $this->never())->method('recordMatches')
                ->with($record, 'submission-proof.note')->willReturn($matches);
            $container->instance(ResourceAuthorization::class, $authorization);

            expect($policy->{$action}($actor, $record))->toBe($expected);
        }
    } finally {
        PermissionAuthorizerResolver::resetForTests();
        Container::setInstance($previousContainer);
    }
})->with([
    ['view', 'submission-proof.note.read'],
    ['update', 'submission-proof.note.update'],
    ['delete', 'submission-proof.note.delete'],
]);
