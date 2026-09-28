<?php

declare(strict_types=1);

namespace Nexia\Apps\Nexia\SubmissionProof;

use Nexia\AppRuntime\AppPackageMetadataReader;
use Nexia\AppRuntime\Contracts\AppRegistrar;
use Illuminate\Support\ServiceProvider;

class SubmissionProofServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $definition = $this->app
            ->make(AppPackageMetadataReader::class)
            ->read(__DIR__.'/../composer.json');
        $manifest = new SubmissionProofAppManifest($definition);

        $this->app->instance(SubmissionProofAppManifest::class, $manifest);
    }

    public function boot(): void
    {
        $this->app->make(AppRegistrar::class)->register(
            $this->app->make(SubmissionProofAppManifest::class),
        );

        $this->loadRoutesFrom(__DIR__.'/../routes/routes.php');
        $this->loadJsonTranslationsFrom(__DIR__.'/../resources/lang');
    }
}
