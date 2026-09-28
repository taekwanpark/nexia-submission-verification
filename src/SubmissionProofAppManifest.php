<?php

declare(strict_types=1);

namespace Nexia\Apps\Nexia\SubmissionProof;

use Nexia\AppRuntime\AbstractPackageAppManifest;
use Nexia\Navigation\Contracts\NavigationContribution;
use Nexia\Navigation\NavigationItem;

final class SubmissionProofAppManifest extends AbstractPackageAppManifest implements NavigationContribution
{
    /**
     * @return list<array{namespace: string, directory: string}>
     */
    public function contributionLocations(): array
    {
        return [
            ['namespace' => 'Nexia\Apps\Nexia\SubmissionProof\\Contribution', 'directory' => __DIR__.'/Contribution'],
            ['namespace' => 'Nexia\Apps\Nexia\SubmissionProof\\Descriptors', 'directory' => __DIR__.'/Descriptors'],
        ];
    }

    /**
     * @return list<array{id: string, route: string, permission: string|null, icon: string, sort: int, label_key: string, app_key: string, context_id: string, group_id: string, searchable: bool}>
     */
    public static function navigationItems(): array
    {
        return [
            NavigationItem::make(
                id: 'submission-proof',
                route: '/apps/submission-proof',
                icon: 'box',
                sort: 500,
                labelKey: 'submission-proof.overview.title',
                appKey: 'submission-proof',
                permission: null,
                contextId: 'app', groupId: null,
            ),
        ];
    }

    public function tenantFilamentResources(): array
    {
        return [
            // nexia:make-package-resource:tenant-filament-resources:end
        ];
    }

    public function tenantMigrationPaths(): array
    {
        $path = __DIR__.'/../database/migrations/tenant';

        // Source snapshots omit empty directories until the first Resource exists.
        return is_dir($path) ? [$path] : [];
    }

    public function pageElementsExtras(): array
    {
        return [
            '/apps/submission-proof' => 'SubmissionProofOverviewSurface',
            // nexia:pages:end
        ];
    }

}
