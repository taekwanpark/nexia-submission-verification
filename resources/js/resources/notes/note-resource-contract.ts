import type { useTranslation } from 'react-i18next';
import type {
    ResourceActionDescriptor,
    ResourceRef,
} from '@nexia/sdk';

export interface NoteRecord {
    id: string;
    public_id: string;
    /** Present for Legal Entity-owned records; derived from the stored owner. */
    legal_entity_public_id?: string | null;
    legal_entity_label?: string | null;
    name: string;
    created_at: string | null;
    updated_at: string | null;
    actions: ResourceActionDecisions;
}

/** Editable business fields shared by the form and mutation. */
export interface NoteInput {
    name: string;
}

export interface ResourceActionDecisions {
    view: boolean;
    update: boolean;
    delete: boolean;
}

export const noteResourceType = 'submission-proof.note';

export const notePermissions = {
    read: 'submission-proof.note.read',
    create: 'submission-proof.note.create',
    update: 'submission-proof.note.update',
    delete: 'submission-proof.note.delete',
} as const;

interface NoteActionCallbacks {
    /** Deprecated route callbacks; generated actions use canonical hrefs. */
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    deleteDisabled?: boolean;
    testIdPrefix?: string;
}

type NoteActionTranslator = ReturnType<
    typeof useTranslation
>['t'];

/** One action contract shared by row menus and the Inspector. */
export function noteResourceActions(
    note: NoteRecord,
    t: NoteActionTranslator,
    callbacks: NoteActionCallbacks,
): ResourceActionDescriptor[] {
    const testId = (id: string) =>
        callbacks.testIdPrefix
            ? `${callbacks.testIdPrefix}-${id}`
            : undefined;

    return [
        ...(note.actions.view
            ? [{
                  id: 'show',
                  label: t('common.actions.view'),
                  permissions: [notePermissions.read],
                  testId: testId('show'),
                  href: noteShowRoute(noteResourceId(note)),
              }]
            : []),
        ...(note.actions.update
            ? [{
                  id: 'edit',
                  label: t('common.actions.edit'),
                  permissions: [notePermissions.update],
                  testId: testId('edit'),
                  href: noteEditRoute(noteResourceId(note)),
              }]
            : []),
        ...(note.actions.delete
            ? [{
                  id: 'delete',
                  label: t('common.actions.delete'),
                  permissions: [notePermissions.delete],
                  destructive: true,
                  disabled: callbacks.deleteDisabled,
                  testId: testId('delete'),
                  onSelect: callbacks.onDelete,
              }]
            : []),
    ];
}

export function noteApiRoute(
    id?: string | number | null,
    legalEntityId?: string | null,
) {
    // Canonical resource endpoints carry no Shell Legal Entity state. List and
    // create targets are request-owned; record endpoints derive the owner.
    void legalEntityId;
    const base = '/submission-proof/notes';

    return id ? `${base}/${id}` : base;
}

export function noteListRoute() {
    return '/apps/submission-proof/notes';
}

export function noteShowRoute(id: string | number) {
    return `/apps/submission-proof/notes/${id}`;
}

export function noteCreateRoute() {
    return '/apps/submission-proof/notes/new';
}

export function noteEditRoute(id: string | number) {
    return `/apps/submission-proof/notes/${id}/edit`;
}

export function noteRoute(id?: string | number | null) {
    return id ? noteShowRoute(id) : noteListRoute();
}

export function noteResourceId(
    note: Pick<NoteRecord, 'id' | 'public_id'>,
) {
    return String(note.public_id ?? note.id);
}

export function noteResourceRef(
    note: NoteRecord,
): ResourceRef<NoteRecord> {
    const id = noteResourceId(note);

    return {
        type: noteResourceType,
        id,
        label: note.name,
        ...(note.actions.view
            ? { route: noteShowRoute(id) }
            : {}),
        data: note,
    };
}

/** Metadata loads with the App; the Inspector implementation stays lazy. */
export const resourceInspector = {
    type: noteResourceType,
    load: () => import('./surface/NoteRecordSurface').then(module => ({
        default: module.NoteInspector,
    })),
};
