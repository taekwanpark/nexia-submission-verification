<?php

declare(strict_types=1);

use Nexia\Apps\Nexia\SubmissionProof\SubmissionProofAppManifest;

test('the registered App keeps its declared overview surface', function () {
    $manifest = json_decode(file_get_contents(__DIR__.'/../nexia.json'), true, flags: JSON_THROW_ON_ERROR);
    expect((new SubmissionProofAppManifest(\Nexia\AppRuntime\AppDefinition::fromArray($manifest['app'])))->pageElementsExtras())
        ->toBe(['/apps/submission-proof' => 'SubmissionProofOverviewSurface']);
});
