<?php

declare(strict_types=1);

use Nexia\Contribution\ResourceLegalEntityParticipation;
use Nexia\Contribution\ResourceRecordOwner;
use Nexia\Permission\AssignmentScope;
use Nexia\Apps\Nexia\SubmissionProof\Contribution\Resources\NoteModule;

test('note publishes an explicit resource authorization contract', function () {
    $contract = NoteModule::resourceAuthorization();

    expect($contract->recordOwner)->toBe(ResourceRecordOwner::Tenant)
        ->and($contract->permissionScope)->toBe(AssignmentScope::Tenant)
        ->and($contract->legalEntityParticipation)->toBe(
            ResourceLegalEntityParticipation::None,
        )
        ->and(NoteModule::permissionAssignmentScope())->toBe(
            AssignmentScope::Tenant,
        );
});
