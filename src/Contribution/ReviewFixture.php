<?php

declare(strict_types=1);

namespace Nexia\Apps\Nexia\SubmissionProof\Contribution;

use Nexia\Apps\Nexia\SubmissionProof\Models\Note;
use Nexia\Fixture\Contracts\FixtureContribution;
use Nexia\Fixture\FixtureContext;

/** Disposable review data; never part of installation initialization. */
final class ReviewFixture implements FixtureContribution
{
    public function appKey(): string { return 'submission-proof'; }

    public function fixtureKeys(): array { return ['review']; }

    public function seed(FixtureContext $context): void
    {
        if ($context->fixtureKey !== 'review') {
            throw new \InvalidArgumentException('Only the review fixture is supported.');
        }
        foreach (['Alpha review note', 'Zulu review note'] as $index => $name) {
            Note::firstOrCreate(
                ['public_id' => '00000000-0000-4000-8000-00000000010'.($index + 1)],
                ['name' => $name],
            );
        }
    }
}
