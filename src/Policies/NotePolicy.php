<?php

declare(strict_types=1);

namespace Nexia\Apps\Nexia\SubmissionProof\Policies;

use Nexia\Laravel\Access\Contracts\ResourceAuthorization;
use Nexia\Laravel\Access\Concerns\EvaluatesPermissionDecision;
use Nexia\Identity\Contracts\Actor;
use Nexia\Apps\Nexia\SubmissionProof\Models\Note;

/**
 * Authorization for Note.
 *
 * Generated for a package-owned tenant resource. This mirrors the core
 * collection-resource policy shape while using package-owned permission keys.
 */
class NotePolicy
{
    use EvaluatesPermissionDecision;

    public function viewAny(Actor $user): bool
    {
        return $this->allowsPermission($user, 'submission-proof.note.read');
    }

    public function view(Actor $user, Note $note): bool
    {
        return $this->allowsPermission($user, 'submission-proof.note.read')
            && $this->matchesAuthorizationContract($note);
    }

    public function create(Actor $user): bool
    {
        return $this->allowsPermission($user, 'submission-proof.note.create');
    }

    public function update(Actor $user, Note $note): bool
    {
        return $this->allowsPermission($user, 'submission-proof.note.update')
            && $this->matchesAuthorizationContract($note);
    }

    public function delete(Actor $user, Note $note): bool
    {
        // Destructive lifecycle actions are opt-in. Keep the generated
        // delete route and row action available for the domain owner to
        // enable explicitly after choosing the resource lifecycle.
        return false;
    }

    private function matchesAuthorizationContract(Note $note): bool
    {
        return app(ResourceAuthorization::class)
            ->recordMatches($note, 'submission-proof.note');
    }
}
