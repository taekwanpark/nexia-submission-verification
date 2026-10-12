<?php

declare(strict_types=1);

namespace Nexia\Apps\Nexia\SubmissionProof\Contribution\Resources;

use Nexia\Apps\Nexia\SubmissionProof\Models\Note;
use Nexia\AppDescriptors\DescriptorStatus;
use Nexia\AppDescriptors\ResourceDescriptor;
use Nexia\AppDescriptors\ResourceMutationDescriptor;
use Nexia\AppRuntime\ShellResourceDescriptor;
use Nexia\AppRuntime\Contracts\ShellResourceContribution;
use Nexia\Contribution\AbstractResourceModule;
use Nexia\Contribution\ResourceAuthorizationContract;
use Nexia\Contribution\Contracts\ResourceAuthorizationContribution;
use Nexia\Contribution\Contracts\ResourceCatalogContribution;
use Nexia\Contribution\ResourceLegalEntityParticipation;
use Nexia\Contribution\ResourceModuleDefinition;
use Nexia\Contribution\ResourceRecordOwner;
use Nexia\Navigation\Concerns\ContributesNavigationDestination;
use Nexia\Navigation\Concerns\ContributesNavigationDestinationActions;
use Nexia\Navigation\Contracts\NavigationContribution;
use Nexia\Navigation\ShellNavigationLocateAction;
use Nexia\Permission\AssignmentScope;
use Nexia\Permission\Concerns\ContributesResourcePermissions;
use Nexia\Permission\Contracts\PermissionContribution;
use Nexia\Reports\Contracts\ReportContribution;
use Nexia\Reports\ReportDefinition;

final class NoteModule extends AbstractResourceModule implements NavigationContribution, PermissionContribution, ResourceAuthorizationContribution, ResourceCatalogContribution, ShellResourceContribution, ReportContribution
{
    use ContributesNavigationDestination;
    use ContributesNavigationDestinationActions;
    use ContributesResourcePermissions;
    public static function shellResource(): ShellResourceDescriptor
    {
        return new ShellResourceDescriptor(shapes: ['list', 'record']);
    }

    protected static array $navigation = [
        'path' => 'notes',
        'icon' => 'box',
        'order' => 500,
        'context' => 'app',
        'group' => 'operations',
        'subgroup' => NULL,
        'visible' => true,
        'permission' => ['submission-proof.note.read', 'submission-proof.note.create'],
    ];

    public static function resourceKey(): string
    {
        return 'submission-proof.note';
    }

    public static function resourceModelClass(): string
    {
        return Note::class;
    }

    public static function reports(): array
    {
        return [ReportDefinition::count(self::resourceKey().'.count', 'submission-proof.note.list.title', self::resourceKey())];
    }

    public static function resourceModuleDefinition(): ResourceModuleDefinition
    {
        // Input contracts describe the owning controller, not the database columns.
        // Keep these aligned when changing store/update validation or target selection.
        $inputProperties = [
            'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 255],
        ];

        return ResourceModuleDefinition::fromDescriptor(new ResourceDescriptor(
            key: self::resourceKey(),
            version: '1.0',
            labelKey: 'submission-proof.note.list.title',
            status: DescriptorStatus::Active,
            fieldSchema: [
                // Report composition is opt-in: add only business fields with
                // reviewed labels and authorization; never infer model columns.
                // Person selector example; eligibility is login-member-only:
                // 'person_party_public_id' => [
                //     'type' => 'resource_reference',
                //     'accepted_resource_keys' => ['directory.party'],
                //     'selector_purpose' => 'submission-proof.reference-options',
                //     'selector_permissions' => ['submission-proof.note.create'],
                //     'party_selection' => [
                //         'types' => ['person'],
                //         // 'eligibility' => 'active_legal_entity_member',
                //     ],
                // ],
                'public_id' => [
                    'type' => 'string',
                    'format' => 'uuid',
                    'label_key' => 'submission-proof.note.id.label',
                ],
                'name' => [
                    'type' => 'string',
                    'label_key' => 'submission-proof.note.name.label',
                    'composition' => ['selectable' => true, 'groupable' => true, 'filter_operators' => ['eq', 'in', 'contains', 'starts_with', 'ends_with', 'is_null', 'not_null']],
                ],
                // Generated baseline for timestamped models. Remove it when the
                // model does not use timestamps rather than fabricating a field.
                'created_at' => [
                    'type' => 'string',
                    'format' => 'date-time',
                    'label_key' => 'common.fields.created_at',
                    'composition' => ['selectable' => true, 'groupable' => true, 'time_buckets' => ['day', 'month', 'quarter', 'year'], 'filter_operators' => ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'not_null']],
                ],
            ],
            searchSchema: [
                'label_fields' => ['name'],
            ],
            mutation: new ResourceMutationDescriptor(
                createInputSchema: ['type' => 'object', 'properties' => $inputProperties, 'required' => ['name']],
                updateInputSchema: ['type' => 'object', 'properties' => $inputProperties],
            ),
        ));
    }

    public static function permissionAssignmentScope(): AssignmentScope
    {
        return AssignmentScope::Tenant;
    }

    public static function resourceAuthorization(): ResourceAuthorizationContract
    {
        return ResourceAuthorizationContract::standard(
            ResourceRecordOwner::Tenant,
            AssignmentScope::Tenant,
            ResourceLegalEntityParticipation::None,
        );
    }

    public static function permissionResources(): array
    {
        return [
            'submission-proof.note' => ['read', 'create', 'update', 'delete'],
        ];
    }

    protected static function agentNavigationActionDefinitions(): array
    {
        return [
            ShellNavigationLocateAction::make(
                action: 'submission-proof.note.locate',
                url: '/apps/submission-proof/notes',
                permission: 'submission-proof.note.read',
            ),
        ];
    }
}
