<?php

declare(strict_types=1);

use Nexia\Apps\Nexia\SubmissionProof\SubmissionProofAppManifest;

test('the registered App keeps its declared overview surface', function () {
    expect((new SubmissionProofAppManifest)->pageElementsExtras())
        ->toBe(['/apps/submission-proof' => 'SubmissionProofOverviewSurface']);
});
