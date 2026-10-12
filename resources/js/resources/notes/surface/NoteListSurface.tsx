import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    isHttpError,
    type ResourceRef,
    type ResourceListParams,
    type AppRoutePrefetchContext,
    type ResourceTableColumn,
} from '@nexia/sdk';
import {
    ResourceTable,
    ResourcePrimaryCell,
    ResourceRowActionsMenu,
    ResourceTextCell,
    ResourceInspectorStackHost,
    ResourceInspectorStackProvider,
    keepPreviousResourceListData,
    useResourceListParams,
    WorkSurface,
    WorkSection,
    useContextQuery,
    usePermissionsQuery,
    api,
    can,
    useMessage,
    useWorkSurfaceLabels,
    useOpenResourceWorkTab,
    useRegisterListLocateAction,
    NxButton,
    NxPageFrame,
    NxEmptyView,
    NxActionButton,
    NxSearchField,
} from '@nexia/sdk/host';
import { NxOrganizationTargetSelector, useOrganizationTargetsQuery, useOrganizationListScope } from '@nexia/sdk/host';
import {
    type NoteRecord,
    noteApiRoute,
    noteCreateRoute,
    noteShowRoute,
    noteEditRoute,
    notePermissions,
    noteResourceActions,
    noteResourceId,
    noteResourceRef,
} from '#app/resources/notes/note-resource-contract.ts';
import { useNoteDelete, noteDetailQueryOptions, fetchNoteList, noteListQueryScope, noteListQueryOptions } from '#app/resources/notes/note-queries.ts';

export function prefetch(context: AppRoutePrefetchContext): void {
    // Target availability is page-owned, never inferred from Shell state.
    void context;
}

export default function NoteListSurface() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: context, isPending: contextPending, isError: contextError, error: contextFailure, refetch: refetchContext } = useContextQuery();
    const tenantId = context?.tenant?.id;
    const organizationScope = useOrganizationListScope(
        tenantId,
        notePermissions.read,
        'legal-entity-list',
        false,
    );
    const { data: permissionData, isPending: permissionsPending, isError: permissionsError, error: permissionsFailure, refetch: refetchPermissions } = usePermissionsQuery(
        tenantId,
        null,
    );
    const permissions = permissionData?.permissions ?? [];
    const createTargets = useOrganizationTargetsQuery(
        tenantId,
        notePermissions.create,
        {},
        false && !!tenantId,
    );
    const creatableLegalEntityPublicIds = useMemo(() => (createTargets.data?.data ?? [])
        .filter((target) => target.operating_unit === null)
        .map((target) => target.legal_entity.public_id), [createTargets.data]);
    const legalEntityPublicIds = organizationScope.query.legalEntityPublicIds ?? [];
    const canRead = false
        ? organizationScope.canRead
        : can(permissions, notePermissions.read);
    const canCreateFallback = false
        ? !createTargets.isPending && !createTargets.isError && creatableLegalEntityPublicIds.length > 0
        : can(permissions, notePermissions.create);
    const resourceContextId = false ? legalEntityPublicIds.join(',') : tenantId ?? null;
    const { confirm } = useMessage();

    const {
        search,
        setSearch,
        sort,
        setSort,
        filters,
        setFilters,
        setParams,
        page,
        setPage,
        perPage,
        setPerPage,
    } = useResourceListParams();

    const listQueryScope = noteListQueryScope(
        tenantId ?? '',
        resourceContextId,
    );
    const listParams = { search, sort, filters, page, perPage };

    const fetchList = useCallback(
        (params: ResourceListParams, signal?: AbortSignal) => {
            if (!canRead || (false && organizationScope.requestParams === undefined)) {
                throw new Error('Organization scope is not readable.');
            }
            return fetchNoteList(legalEntityPublicIds, params, signal);
        },
        [canRead, legalEntityPublicIds, organizationScope.requestParams],
    );

    const {
        data: list,
        isLoading,
        isFetching,
        isError,
        error: listFailure,
        refetch,
    } = useQuery({
        ...noteListQueryOptions(
            tenantId ?? '',
            legalEntityPublicIds,
            listParams,
        ),
        placeholderData: keepPreviousResourceListData(listQueryScope),
        queryFn: ({ signal }) => fetchList(listParams, signal),
        enabled: !!tenantId && canRead && (!false || organizationScope.requestParams !== undefined),
    });
    const deleteResource = useNoteDelete(tenantId ?? '');

    const accessPending = !contextError && (contextPending || (!!tenantId && (false ? organizationScope.isLoading : permissionsPending)));
    const listError = contextError || (false ? organizationScope.isError : permissionsError) || isError;
    const failure = contextError ? contextFailure
        : false && organizationScope.isError ? organizationScope.targets.error
        : !false && permissionsError ? permissionsFailure : listFailure;
    const failureStatus = isHttpError(failure) ? failure.response?.status : undefined;
    const listReadable = !!tenantId && canRead && !accessPending && !listError;
    const rows = listReadable ? list?.data ?? [] : [];
    const meta = listReadable ? list?.meta : undefined;
    const canCreate = (listReadable || (!!tenantId && !canRead && !accessPending && !listError))
        && (meta?.actions.create ?? canCreateFallback);
    const labels = useWorkSurfaceLabels({
        action: 'list',
        resourceLabel: t('submission-proof.note.list.title'),
    });

    useRegisterListLocateAction<NoteRecord>({
        actionType: 'submission-proof.note.locate',
        label: t('submission-proof.note.agent.locate.label'),
        description: t('submission-proof.note.agent.locate.description'),
        enabled: listReadable,
        schema: meta?.list_schema,
        params: { setParams, perPage },
        fetchPage: async (listParams) => {
            if (!canRead || (false && organizationScope.requestParams === undefined)) {
                throw new Error('Organization scope is not readable.');
            }
            const result = await queryClient.fetchQuery({
                queryKey: [
                    ...listQueryScope,
                    {
                        search: listParams.search,
                        sort: listParams.sort,
                        filters: listParams.filters,
                        page: listParams.page,
                        perPage: listParams.perPage,
                    },
                ],
                queryFn: ({ signal }) => fetchList(listParams, signal),
            });
            return { rows: result.data ?? [], total: result.meta?.total ?? null };
        },
        resolveRow: (row) => {
            const id = noteResourceId(row);
            return {
                id,
                label: row.name,
                ...(row.actions.view
                    ? { showUrl: noteShowRoute(id) }
                    : {}),
                ...(row.actions.update
                    ? { editUrl: noteEditRoute(id) }
                    : {}),
            };
        },
        onMatch: (row) => {
            if (row.actions.view) {
                setSelectedId(noteResourceId(row));
            }
        },
    });

    const selected = useMemo(
        () =>
            selectedId
                ? rows.find((row) => noteResourceId(row) === selectedId) ??
                  null
                : null,
        [rows, selectedId],
    );
    const rootResource = selected?.actions.view
        ? noteResourceRef(selected)
        : null;
    const openOrFocusResourceTab = useOpenResourceWorkTab('document');

    function openResourceDetail(resource: ResourceRef) {
        openOrFocusResourceTab(resource, {
            route: resource.route ?? noteShowRoute(resource.id),
        });
    }

    async function handleDelete(row: NoteRecord) {
        if (!row.actions.delete) return;

        const id = noteResourceId(row);
        const ok = await confirm(
            t('submission-proof.note.confirm_delete'),
            {
                confirmLabel: t('common.actions.delete'),
                variant: 'destructive',
            },
        );
        if (!ok) return;

        deleteResource.mutate(id, {
            onSuccess: () => {
                if (selectedId === id) {
                    setSelectedId(null);
                }
            },
        });
    }

    const createRecord = () => navigate(creatableLegalEntityPublicIds.length === 1
        ? noteCreateRoute() + `?legal_entity_public_id=${encodeURIComponent(creatableLegalEntityPublicIds[0]!)}`
        : noteCreateRoute());
    const selectRow = (row: NoteRecord) => {
        if (row.actions.view) setSelectedId(noteResourceId(row));
    };
    const columns: ResourceTableColumn<NoteRecord>[] = [
        // `sortable` is a visual candidate. ResourceTable intersects it with
        // the backend `meta.list_schema.sortable` catalog before activation.
        {
            key: 'name',
            header: t('submission-proof.note.name.label'),
            size: 'primary',
            // This resource's own primary cell selects the row. Cross-resource
            // reference cells must use ResourceLink without onActivate so they
            // push that reference onto the Inspector stack instead.
            cell: (row) =>
                row.actions.view ? (
                    <ResourcePrimaryCell
                        resource={ noteResourceRef(row) }
                        label={row.name}
                        onActivate={() => selectRow(row)}
                        testId={`note-link-${noteResourceId(row)}`}
                    />
                ) : (
                    <ResourceTextCell primary={row.name} />
                ),
        },
        {
            key: 'actions',
            header: t('common.actions.label'),
            size: 'actions',
            align: 'right',
            cell: (row) => {
                const items = noteResourceActions(row, t, {
                    onDelete: () => void handleDelete(row),
                    deleteDisabled: deleteResource.isPending,
                    testIdPrefix: `note-actions-${noteResourceId(row)}`,
                });

                return items.length > 0 ? (
                    <ResourceRowActionsMenu
                        label={t('common.actions.label')}
                        items={items}
                        testId={`note-actions-${noteResourceId(row)}`}
                    />
                ) : null;
            },
        },
    ];

    return (
        <NxPageFrame showHeader={false}
            maxWidth="none"
            organizationScope={false ? <NxOrganizationTargetSelector {...organizationScope.selectorProps} /> : null}
            actions={
                <>
                    {canCreate ? (
                        <NxActionButton
                            kind="create"
                            label={labels.createButtonLabel}
                            onClick={createRecord}
                            data-testid="note-create"
                        />
                    ) : null}
                </>
            }
        >
            {deleteResource.isError ? <NxEmptyView kind="error" /> : null}
            <ResourceInspectorStackProvider
                root={rootResource}
                onOpenInTab={openResourceDetail}
            >
                <WorkSurface
                    primaryLabel={t('submission-proof.note.list.title')}
                    inspectorLabel={t('submission-proof.note.inspector.title')}
                    resizeLabel={t('submission-proof.note.inspector.resize')}
                    primary={
                        <WorkSection
                            layout="fullBleed"
                            bodyClassName="overflow-hidden"
                        >
                            <ResourceTable
                                tableId="submission-proof.note.list"
                                label={t('submission-proof.note.list.title')}
                                rows={rows}
                                columns={columns}
                                getKey={ noteResourceId }
                                loading={isLoading}
                                access={listError ? undefined : accessPending ? { state: 'pending' } : !canRead ? {
                                    state: 'denied',
                                    deniedTestId: 'note-no-access',
                                    deniedAction: <NxButton type="button" variant="primary" onClick={() => window.alert(t('common.actions.access_request_pending'))}>{t('common.actions.request_access')}</NxButton>,
                                } : undefined}
                                error={listError}
                                errorDescription={failureStatus === 401 ? t('common.errors.unauthenticated')
                                    : failureStatus === 403 ? t('common.status.no_access_description')
                                    : failureStatus === 404 ? t('common.status.not_found_description') : undefined}
                                onRetry={() => {
                                    if (contextError) void refetchContext();
                                    else if (false && organizationScope.isError) void organizationScope.targets.refetch();
                                    else if (!false && permissionsError) void refetchPermissions();
                                    else if (canRead) void refetch();
                                }}
                                hasActiveQuery={Boolean(search.trim())}
                                emptyState={{
                                    title: t('submission-proof.note.list.empty'),
                                    action: canCreate ? <NxActionButton kind="create" label={labels.createButtonLabel} onClick={createRecord} /> : null,
                                    testId: 'note-empty',
                                }}
                                rowTestId={(row) => `note-row-${noteResourceId(row)}`}
                                rowSelected={(row) => selectedId === noteResourceId(row)}
                                onRowClick={selectRow}
                                sort={sort}
                                onSortChange={setSort}
                                schema={meta?.list_schema}
                                filters={filters}
                                onFiltersChange={setFilters}
                                transferMeta={meta?.resource_transfer}
                                onTransferImported={() =>
                                    queryClient.invalidateQueries({
                                        queryKey: listQueryScope,
                                    })
                                }
                                pagination={meta}
                                onPageChange={setPage}
                                onPerPageChange={setPerPage}
                                paginationDisabled={isFetching}
                                footer
                                toolbar={{
                                    leading: (
                                        <NxSearchField
                                            value={search}
                                            onChange={setSearch}
                                            placeholder={t('submission-proof.note.list.search.placeholder',
                                            )}
                                            aria-label={t('submission-proof.note.list.search.label',
                                            )}
                                            data-testid="note-search"
                                        />
                                    ),
                                }}
                            />
                        </WorkSection>
                    }
                    inspector={
                        <ResourceInspectorStackHost
                            emptyState={
                                <p className="text-xs text-text-tertiary">
                                    {t('submission-proof.note.inspector.empty')}
                                </p>
                            }
                            onClose={() => setSelectedId(null)}
                        />
                    }
                />
            </ResourceInspectorStackProvider>
        </NxPageFrame>
    );
}
