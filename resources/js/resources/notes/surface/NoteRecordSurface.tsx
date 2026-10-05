import {
    isHttpError,
    type FormFieldErrors,
    type ResourceInspectorAdapter,
    type ResourceFormSaved,
    type ResourceFormLegalEntity,
    parseLegalEntityCreateTargetSearchParams,
} from '@nexia/sdk';
import {
    useNavigate,
    useLocation,
    useParams,
    useSearchParams,
} from 'react-router-dom';
import {
    useTranslation,
} from 'react-i18next';
import {
    queryOptions,
    useQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import {
    api,
    NxFormSection,
    NxFormField,
    NxTextInput,
    NxDetailRow,
    NxSectionCard,
    NxResourceFormLegalEntityField,
    ResourceInspectorQuery,
    InspectorResourceActions,
    useMessage,
    useDateTimeFormatter,
    useMarkTabDirty,
    NxButton,
    NxEmptyView,
    NxLoadingBlock,
    NxPageFrame,
    NxActionButton,
    NxActions,
    useContextQuery,
    useWorkSurfaceLabels,
    useWorkTabLabel,
    firstFieldError,
    NxSelect,
    useClearTabDirty,
    parseMutationFormError,
    useResourceCreateCompletion,
    withoutFieldError,
    useOrganizationTargetsQuery,
} from '@nexia/sdk/host';
import {
    type NoteRecord,
    type NoteInput,
    noteApiRoute,
    noteEditRoute,
    noteResourceId,
    noteShowRoute,
    noteListRoute,
    notePermissions,
    noteResourceActions,
} from '#app/resources/notes/note-resource-contract.ts';

import {
    type FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useNoteDelete, noteDetailQueryOptions, type NoteDetailResponse } from '#app/resources/notes/note-queries.ts';

interface NoteRecordSurfaceProps {
    mode: 'read' | 'create' | 'edit';
}

interface NoteCollectionActionsResponse {
    meta: {
        actions: {
            create: boolean;
        };
    };
}

function noteCollectionActionsQueryOptions(
    tenantId: string,
) {
    const resourceContextId = tenantId;

    return queryOptions({
        queryKey: [
            'submission-proof-notes',
            tenantId,
            resourceContextId,
            'collection-actions',
        ],
        queryFn: async ({ signal }) => {
            const { data } = await api.get<NoteCollectionActionsResponse>(
                noteApiRoute() + '/actions',
                { signal },
            );
            return data;
        },
    });
}

function RecordContent({
    mode: explicitMode,
}: NoteRecordSurfaceProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const mode = explicitMode;
    const { data: context } = useContextQuery();
    const tenantId = context?.tenant?.id;
    const [searchParams, setSearchParams] = useSearchParams();
    const createTarget = useMemo(() => {
        if (mode !== 'create') {
            return { legalEntityPublicId: null, invalid: false };
        }

        try {
            return {
                legalEntityPublicId: parseLegalEntityCreateTargetSearchParams(searchParams).legalEntityPublicId ?? null,
                invalid: false,
            };
        } catch {
            return { legalEntityPublicId: null, invalid: true };
        }
    }, [mode, searchParams]);
    const targetQuery = useOrganizationTargetsQuery(
        tenantId,
        notePermissions.create,
        {},
        false && mode === 'create' && !!tenantId,
    );
    const legalEntityOptions = useMemo(() => (targetQuery.data?.data ?? [])
        .filter((target) => target.operating_unit === null)
        .map((target) => ({
            value: target.legal_entity.public_id,
            label: `${target.legal_entity.code} · ${target.legal_entity.name}`,
        })), [targetQuery.data]);
    const [legalEntityId, setLegalEntityId] = useState<string | null>(createTarget.legalEntityPublicId);
    const selectCreateLegalEntity = useCallback((nextLegalEntityId: string | null) => {
        setLegalEntityId(nextLegalEntityId);
        if (!createTarget.invalid) return;

        const next = new URLSearchParams(searchParams);
        for (const key of [
            'legal_entity_public_id',
            'legal_entity_public_id[]',
            'legal_entity_public_ids',
            'legal_entity_public_ids[]',
            'operating_unit_public_id',
            'operating_unit_public_id[]',
            'operating_unit_public_ids',
            'operating_unit_public_ids[]',
        ]) next.delete(key);
        if (nextLegalEntityId) {
            next.set('legal_entity_public_id', nextLegalEntityId);
        }
        setSearchParams(next, { replace: true });
    }, [createTarget.invalid, searchParams, setSearchParams]);
    useEffect(() => {
        if (!false || mode !== 'create') return;
        setLegalEntityId(createTarget.legalEntityPublicId);
    }, [mode, createTarget.legalEntityPublicId, createTarget.invalid]);
    useEffect(() => {
        if (
            !false
            || mode !== 'create'
            || createTarget.invalid
            || createTarget.legalEntityPublicId
        ) return;
        if (legalEntityOptions.length !== 1) return;

        setLegalEntityId((current) => current ?? legalEntityOptions[0]!.value);
    }, [mode, createTarget.legalEntityPublicId, legalEntityOptions]);
    const resourceContextId = mode === 'create' ? legalEntityId ?? tenantId ?? null : tenantId ?? null;
    const hasSelectedLegalEntity = !false || legalEntityOptions.some(
        (option) => option.value.toLowerCase() === legalEntityId?.toLowerCase(),
    );
    const queryClient = useQueryClient();
    const resourceCreateCompletion = useResourceCreateCompletion();
    const clearTabDirty = useClearTabDirty();
    const [error, setError] = useState<string | null>(null);
    const [savedWithoutRead, setSavedWithoutRead] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const clearFieldError = useCallback((field: string) => {
        setFieldErrors((current) => withoutFieldError(current, field));
    }, []);

    const collectionQuery = useQuery({
        ...noteCollectionActionsQueryOptions(
            tenantId ?? '',
        ),
        // Legal Entity-owned creation gets its authority from exact CREATE
        // targets. Do not probe the READ collection endpoint in that flow.
        enabled: mode === 'create' && !!tenantId && !false,
    });
    const canOpenCreate = false
        ? legalEntityOptions.length > 0
        : collectionQuery.data?.meta.actions.create ?? false;

    const { data: detail, isLoading, error: detailError, isError: detailFailed, refetch: retryDetail } = useQuery({
        ...noteDetailQueryOptions(
            tenantId ?? '',
            id ?? '',
        ),
        enabled: mode !== 'create' && !!tenantId && !!id,
    });

    const item = detail?.note ?? null;
    const canCreate = canOpenCreate
        && (!createTarget.invalid || legalEntityId !== null)
        && hasSelectedLegalEntity;
    const canUpdate = item?.actions.update ?? false;
    const canSubmit = mode === 'create' ? canCreate : mode === 'edit' && canUpdate;

    const cacheSavedRecord = (response: NoteDetailResponse) => {
        const record = response.note;
        queryClient.invalidateQueries({ queryKey: ['submission-proof-notes', tenantId ?? ''] });
        queryClient.setQueryData(
            noteDetailQueryOptions(tenantId ?? '', noteResourceId(record)).queryKey,
            response,
        );
        return record;
    };
    const onAgentSaved = (saved: ResourceFormSaved): NoteRecord | null => {
        const response = saved.response as unknown as NoteDetailResponse;
        const record = response?.note;
        // Decode this App's response, never guess a record identifier in Core.
        if (!record || typeof record.name !== 'string' || !record.actions
            || typeof record.public_id !== 'string' || !record.public_id.trim()
            || typeof record.actions.update !== 'boolean' || typeof record.actions.view !== 'boolean') {
            setError(t('common.status.error'));
            return null;
        }
        if (mode === 'edit' && noteResourceId(record) !== id) return null;
        // Agent delegation has narrower action permissions than the human.
        // Refresh the human-owned cache; never seed it with delegated actions.
        queryClient.invalidateQueries({ queryKey: ['submission-proof-notes', tenantId ?? ''] });
        queryClient.invalidateQueries({
            queryKey: noteDetailQueryOptions(tenantId ?? '', noteResourceId(record)).queryKey,
            exact: true,
        });
        setError(null);
        setFieldErrors({});
        if (mode === 'create') {
            // A completed create becomes an edit before another save is possible.
            // Route state carries only this App's newer input; permissions still
            // come from the authoritative detail response in the destination.
            clearTabDirty();
            navigate(noteEditRoute(noteResourceId(record)), {
                replace: true,
                state: { savedForm: { tenantId, resourceId: noteResourceId(record),
                    name: typeof saved.currentValues.name === 'string' && saved.currentValues.name !== saved.submittedValues.name
                        ? saved.currentValues.name : record.name } },
            });
        }
        return record;
    };
    const carriedDraft = location.state?.savedForm;

    const mutation = useMutation({
        mutationFn: async (payload: NoteInput) => {
            if (mode === 'read' || !canSubmit) throw new Error('Record is not editable.');
            const url =
                mode === 'edit' && id
                    ? noteApiRoute(id)
                    : noteApiRoute();
            const request =
                mode === 'edit'
                    ? api.put(url, payload)
                    : api.post(url, {
                        ...payload,
                        ...(false ? { legal_entity_public_id: legalEntityId } : {}),
                    });
            const { data } = await request;
            return data;
        },
        onError: (mutationError: unknown) => {
            const parsed = parseMutationFormError({
                error: mutationError,
                t,
                fallback: t('common.status.error'),
                fieldLabel: (field) =>
                    t(`submission-proof.note.${field}.label`, {
                        defaultValue: field.replace(/_/g, ' '),
                    }),
            });
            setError(parsed.formError);
            setFieldErrors(parsed.fieldErrors);
        },
        onSuccess: async (response: NoteDetailResponse) => {
            clearTabDirty();
            const record = cacheSavedRecord(response);
            if (
                mode === 'create' &&
                await resourceCreateCompletion.complete({
                    resourceId: noteResourceId(record),
                    display: record.name,
                })
            ) {
                return;
            }
            if (!record.actions.view) {
                setSavedWithoutRead(true);
                return;
            }
            navigate(noteShowRoute(noteResourceId(record)));
        },
    });
    const labels = useWorkSurfaceLabels({
        action: mode === 'read' ? 'show' : mode,
        resourceLabel: t('submission-proof.note.list.title'),
        recordLabel: item?.name,
    });
    useWorkTabLabel(labels.tabLabel);

    if (savedWithoutRead) {
        return (
            <NxPageFrame showHeader={false} currentLabel={labels.breadcrumbLabel}>
                <NxEmptyView kind="empty" title={t('submission-proof.note.saved_without_read')} description="">
                    {mode === 'create' ? (
                        <NxButton onClick={() => setSavedWithoutRead(false)}>
                            {t('common.actions.create')}
                        </NxButton>
                    ) : null}
                </NxEmptyView>
            </NxPageFrame>
        );
    }

    if (mode !== 'create' && isLoading) {
        return (
            <NxPageFrame showHeader={false}
                currentLabel={labels.breadcrumbLabel}
            >
                <NxLoadingBlock
                    shape="text"
                    label={t('common.status.loading')}
                />
            </NxPageFrame>
        );
    }

    const detailStatus = isHttpError(detailError) ? detailError.response?.status : undefined;
    const detailAuthorityLost = detailStatus === 401 || detailStatus === 403 || detailStatus === 404;
    if (mode !== 'create' && detailFailed && (!item || detailAuthorityLost)) {
        const kind = detailStatus === 403 ? 'permission' : detailStatus === 404 ? 'notFound' : 'error';
        return (
            <NxPageFrame currentLabel={labels.breadcrumbLabel}>
                <NxEmptyView kind={kind} description={detailStatus === 401 ? t('common.errors.unauthenticated') : undefined}>
                    {kind === 'error' ? (
                        <NxButton type="button" variant="secondary" onClick={() => void retryDetail()}>
                            {t('common.actions.retry')}
                        </NxButton>
                    ) : null}
                </NxEmptyView>
            </NxPageFrame>
        );
    }

    if (mode !== 'create' && !item) {
        return (
            <NxPageFrame showHeader={false}
                testId="note-form-not-found"
            >
                <NxEmptyView
                    kind="notFound"
                    title={t('submission-proof.note.detail.not_found_title')}
                    description={t('submission-proof.note.detail.not_found')}
                />
            </NxPageFrame>
        );
    }

    if (mode === 'read') {
        if (!item?.actions.view) return <NxPageFrame currentLabel={labels.breadcrumbLabel}><NxEmptyView kind="permission" /></NxPageFrame>;
        const resourceId = noteResourceId(item);

        return (
            <NxPageFrame
                currentLabel={labels.breadcrumbLabel}

                testId="note-detail"
                actions={<>
                    <NxActions resourceKey="submission-proof.note" placement="resource" currentTargets={[{ id: resourceId, label: item.name }]} legalEntityPublicId={item.legal_entity_public_id} onSuccess={() => { void retryDetail(); void queryClient.invalidateQueries({ queryKey: ['submission-proof-notes', tenantId ?? ''] }); }} />
                    {
                    item.actions.update ? (
                        <NxActionButton
                            kind="edit"
                            label={t('common.actions.edit')}
                            type="button"
                            onClick={() => navigate(noteEditRoute(resourceId))}
                            data-testid="note-edit"
                        />
                    ) : null
                    }
                </>}
            >
                {detailFailed ? (
                    <NxEmptyView kind="error">
                        <NxButton type="button" variant="secondary" onClick={() => void retryDetail()}>
                            {t('common.actions.retry')}
                        </NxButton>
                    </NxEmptyView>
                ) : null}
                <RecordDetails item={item} />
            </NxPageFrame>
        );
    }

    if (mode === 'create' && false && targetQuery.isLoading) {
        return (
            <NxPageFrame showHeader={false}
                currentLabel={labels.breadcrumbLabel}
            >
                <NxLoadingBlock
                    shape="text"
                    label={t('common.status.loading')}
                />
            </NxPageFrame>
        );
    }

    if (mode === 'create' && false && targetQuery.isError) {
        return (
            <NxPageFrame showHeader={false}
                currentLabel={labels.breadcrumbLabel}
            >
                <NxEmptyView kind="error">
                    <NxButton
                        type="button"
                        variant="secondary"
                        onClick={() => void targetQuery.refetch()}
                    >
                        {t('common.actions.retry')}
                    </NxButton>
                </NxEmptyView>
            </NxPageFrame>
        );
    }

    if (mode === 'create' && false && createTarget.invalid) {
        return (
            <NxPageFrame showHeader={false}
                currentLabel={labels.breadcrumbLabel}
            >
                <NxSelect<string>
                    ariaLabel={t('common.fields.legal_entity')}
                    value={null}
                    options={legalEntityOptions}
                    onChange={selectCreateLegalEntity}
                    placeholder={t('common.fields.legal_entity')}
                    fullWidth
                />
                <NxEmptyView kind="error" />
            </NxPageFrame>
        );
    }

    if (mode === 'create' && !false && collectionQuery.isLoading) {
        return <NxPageFrame currentLabel={labels.breadcrumbLabel}><NxLoadingBlock shape="text" label={t('common.status.loading')} /></NxPageFrame>;
    }
    if (mode === 'create' && !false && collectionQuery.isError) {
        return <NxPageFrame currentLabel={labels.breadcrumbLabel}><NxEmptyView kind="error">
            <NxButton type="button" variant="secondary" onClick={() => void collectionQuery.refetch()}>{t('common.actions.retry')}</NxButton>
        </NxEmptyView></NxPageFrame>;
    }

    if ((mode === 'create' && !canOpenCreate) || (mode === 'edit' && !canSubmit)) {
        return (
            <NxPageFrame showHeader={false}
                currentLabel={labels.breadcrumbLabel}
                testId="note-form-no-access"
            >
                <NxEmptyView kind="permission">
                    <NxButton
                        type="button"
                        variant="primary"
                        onClick={() =>
                            window.alert(t('common.actions.access_request_pending'))
                        }
                    >
                        {t('common.actions.request_access')}
                    </NxButton>
                </NxEmptyView>
            </NxPageFrame>
        );
    }

    return (
        <NxPageFrame showHeader={false}
            currentLabel={labels.breadcrumbLabel}

            testId="note-form-surface"
        >
            {mode === 'edit' && detailFailed ? (
                <NxEmptyView kind="error">
                    <NxButton type="button" variant="secondary" onClick={() => void retryDetail()}>
                        {t('common.actions.retry')}
                    </NxButton>
                </NxEmptyView>
            ) : null}
            <RecordForm
                key={`${tenantId}:${mode}:${id ?? 'new'}`}
                legalEntity={!false ? undefined : mode === 'create' ? {
                    kind: 'select',
                    value: legalEntityId,
                    options: legalEntityOptions,
                    onChange: (value) => {
                        selectCreateLegalEntity(value);
                        clearFieldError('legal_entity_public_id');
                    },
                    disabled: mutation.isPending,
                    error: firstFieldError(fieldErrors, 'legal_entity_public_id'),
                } : {
                    kind: 'stored',
                    label: item?.legal_entity_label,
                }}
                mode={mode}
                initialItem={item}
                initialName={item?.name ?? ''}
                initialDraftName={carriedDraft?.tenantId === tenantId && carriedDraft?.resourceId === id
                    && typeof carriedDraft?.name === 'string' ? carriedDraft.name : undefined}
                onSaved={onAgentSaved}
                pending={mutation.isPending}
                submitDisabled={!canSubmit}
                error={error}
                fieldErrors={fieldErrors}
                onFieldChange={clearFieldError}
                onCancel={() => {
                    if (mode === 'create' && resourceCreateCompletion.cancel()) {
                        return;
                    }
                    navigate(mode === 'edit' && id ? noteShowRoute(id) : noteListRoute());
                }}
                onSubmit={(payload) => {
                    if (!canSubmit) return;
                    setError(null);
                    setFieldErrors({});
                    mutation.mutate(payload);
                }}
            />
        </NxPageFrame>
    );
}

/** Mode is supplied by the SDK route owner, never inferred from URL or permissions. */
export default function NoteRecordSurface({ mode }: NoteRecordSurfaceProps) {
    if (mode === 'read' || mode === 'create' || mode === 'edit') return <RecordContent mode={mode} />;
    throw new Error('Record screen requires an explicit SDK route mode.');
}

interface RecordFormProps {
    mode: 'create' | 'edit';
    legalEntity?: ResourceFormLegalEntity;
    initialItem?: NoteRecord | null;
    initialName?: string;
    initialDraftName?: string;
    onSaved: (saved: ResourceFormSaved) => NoteRecord | null;
    pending?: boolean;
    submitDisabled?: boolean;
    error?: string | null;
    fieldErrors?: FormFieldErrors;
    onFieldChange?: (field: string) => void;
    onSubmit: (payload: NoteInput) => void;
    onCancel: () => void;
}

/** Ordinary composed inputs use the shared form/Agent binding. */
function RecordForm({
    mode,
    legalEntity,
    initialItem = null,
    initialName = '',
    initialDraftName,
    onSaved,
    pending = false,
    submitDisabled = false,
    error = null,
    fieldErrors,
    onFieldChange,
    onSubmit,
    onCancel,
}: RecordFormProps) {
    const { t } = useTranslation();
    const { formatDateTime } = useDateTimeFormatter();
    const [draft, setDraft] = useState({ name: initialDraftName ?? initialName, baseline: initialName });
    const name = draft.name;
    useEffect(() => {
        // A background refresh may update a clean form, never overwrite a draft.
        setDraft(current => current.name === current.baseline
            ? { name: initialName, baseline: initialName } : current);
    }, [initialName]);

    useMarkTabDirty(name !== draft.baseline);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending || submitDisabled || name.trim() === '') return;
        onSubmit({ name });
    }

    return (
        <NxFormSection
            spacing="section"
            binding={{ effect: 'draft', disabled: pending || submitDisabled, onSaved: saved => {
                const record = onSaved(saved);
                if (!record) return;
                setDraft(current => ({ baseline: record.name,
                    name: current.name === saved.submittedValues.name ? record.name : current.name }));
            } }}
            onSubmit={handleSubmit}
            error={error}
            testId="note-form"
            actions={
                <>
                    <NxActionButton
                        kind="cancel"
                        onClick={onCancel}
                        disabled={pending}
                    />
                    <NxActionButton
                        kind={mode === 'create' ? 'create' : 'save'}
                        type="submit"
                        loading={pending}
                        disabled={pending || submitDisabled || name.trim() === ''}
                        data-testid="note-submit"
                    />
                </>
            }
        >
            <NxSectionCard title={t('submission-proof.note.sections.basics')}
                description={t('submission-proof.note.sections.basics_description')} layout="rows">
            {legalEntity ? <div className="p-inset"><NxResourceFormLegalEntityField target={legalEntity} mode={mode} /></div> : null}
            {initialItem ? <NxDetailRow label={t('submission-proof.note.id.label')}>
                {noteResourceId(initialItem)}
            </NxDetailRow> : null}
            <NxFormField layout="row" fieldKey="name" label={t('submission-proof.note.name.label')}
                required error={firstFieldError(fieldErrors, 'name')}>
                {slot => <NxTextInput id={slot.id} aria-describedby={slot.describedBy}
                    invalid={slot.invalid} value={name} required disabled={pending || submitDisabled}
                    onValueChange={value => {
                        setDraft(current => ({ ...current, name: value }));
                        onFieldChange?.('name');
                    }} data-testid="note-name-input" />}
            </NxFormField>
            {initialItem ? <>
                <NxDetailRow label={t('common.fields.created_at')}>
                    {initialItem.created_at ? formatDateTime(initialItem.created_at) : t('common.cell.empty')}
                </NxDetailRow>
                <NxDetailRow label={t('common.fields.updated_at')}>
                    {initialItem.updated_at ? formatDateTime(initialItem.updated_at) : t('common.cell.empty')}
                </NxDetailRow>
            </> : null}
            </NxSectionCard>
        </NxFormSection>
    );
}

/** Readable values, never disabled inputs; also used by the Inspector. */
export function RecordDetails({ item }: { item: NoteRecord }) {
    const { t } = useTranslation();
    const { formatDateTime } = useDateTimeFormatter();
    return <NxSectionCard title={t('submission-proof.note.sections.basics')}
        description={t('submission-proof.note.sections.basics_description')} layout="rows">
        {false ? <NxDetailRow label={t('common.fields.legal_entity')}>
            {item.legal_entity_label ?? t('common.cell.empty')}
        </NxDetailRow> : null}
        <NxDetailRow label={t('submission-proof.note.id.label')}>
            {noteResourceId(item)}
        </NxDetailRow>
        <NxDetailRow label={t('submission-proof.note.name.label')}>{item.name}</NxDetailRow>
        <NxDetailRow label={t('common.fields.created_at')}>
            {item.created_at ? formatDateTime(item.created_at) : t('common.cell.empty')}
        </NxDetailRow>
        <NxDetailRow label={t('common.fields.updated_at')}>
            {item.updated_at ? formatDateTime(item.updated_at) : t('common.cell.empty')}
        </NxDetailRow>
    </NxSectionCard>;
}

/** Inspector uses the same read content without mounting page navigation or form state. */
export const NoteInspector: ResourceInspectorAdapter<NoteRecord> = ({
    resource,
    stack,
}) => {
    const { t } = useTranslation();
    const id = resource.id;
    const queryClient = useQueryClient();
    const { data: context } = useContextQuery();
    const tenantId = context?.tenant?.id;
    const detail = useQuery({
        ...noteDetailQueryOptions(tenantId ?? '', id),
        select: (response) => response.note,
        enabled: !!tenantId && !!id,
    });
    const status = isHttpError(detail.error) ? detail.error.response?.status : undefined;
    const authorityLost = status === 401 || status === 403 || status === 404;
    const item = authorityLost ? undefined : detail.data;
    const { confirm } = useMessage();
    const deleteResource = useNoteDelete(tenantId ?? '');

    async function handleDelete() {
        if (!item?.actions.view || !item.actions.delete || deleteResource.isPending) return;

        const ok = await confirm(t('submission-proof.note.confirm_delete'), {
            confirmLabel: t('common.actions.delete'),
            variant: 'destructive',
        });
        if (!ok) return;

        deleteResource.mutate(resource.id, { onSuccess: () => stack.reset() });
    }

    const actions = item?.actions.view
        ? noteResourceActions(item, t, {
              onView: () => stack.openInTab(resource),
              onEdit: () =>
                  stack.openInTab({
                      ...resource,
                      route: noteEditRoute(resource.id),
                  }),
              onDelete: () => void handleDelete(),
              deleteDisabled: deleteResource.isPending,
              testIdPrefix: 'note-inspector',
          })
        : [];

    return <>
        {deleteResource.isError ? <NxEmptyView kind="error" /> : null}
        <ResourceInspectorQuery<NoteRecord>
            testId="note-inspector"
            query={detail}
            canView={(record) => record.actions.view}
            actions={(record) => <><InspectorResourceActions actions={actions} /><NxActions resourceKey="submission-proof.note" placement="inspector" currentTargets={[{ id: resource.id, label: record.name }]} legalEntityPublicId={record.legal_entity_public_id} onSuccess={() => { void detail.refetch(); void queryClient.invalidateQueries({ queryKey: ['submission-proof-notes', tenantId ?? ''] }); }} /></>}
        >
            {(record) => <RecordDetails item={record} />}
        </ResourceInspectorQuery>
    </>;
};
