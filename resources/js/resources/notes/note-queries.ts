import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResourceListParams, ResourceListSchema, ResourceTransferMeta } from '@nexia/sdk';
import { api, serializeResourceTableSort } from '@nexia/sdk/host';
import { noteApiRoute, type NoteRecord } from './note-resource-contract.ts';

export interface NoteDetailResponse {
    note: NoteRecord;
}

export function noteDetailQueryOptions(
    tenantId: string,
    id: string,
) {
    const resourceContextId = tenantId;

    return queryOptions({
        queryKey: [
            'submission-proof-note',
            tenantId,
            resourceContextId,
            id,
        ],
        queryFn: async ({ signal }) => {
            const { data } = await api.get<NoteDetailResponse>(
                noteApiRoute(id),
                { signal },
            );
            return data;
        },
    });
}

interface NoteListResponse {
    data: NoteRecord[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        list_schema: ResourceListSchema;
        actions: {
            create: boolean;
        };
        resource_transfer?: ResourceTransferMeta | null;
    };
}

export function noteListQueryScope(
    tenantId: string,
    resourceContextId: string | number | null,
) {
    return [
        'submission-proof-notes',
        tenantId,
        resourceContextId,
    ] as const;
}

export async function fetchNoteList(
    legalEntityPublicIds: readonly string[],
    listParams: ResourceListParams,
    signal?: AbortSignal,
): Promise<NoteListResponse> {
    const params: Record<string, string | number | string[]> = {};
    if (listParams.search) params.search = listParams.search;
    if (listParams.sort)
        params.sort = serializeResourceTableSort(listParams.sort);
    if (listParams.page && listParams.page > 1)
        params.page = listParams.page;
    if (listParams.perPage) params.per_page = listParams.perPage;
    for (const [key, value] of Object.entries(listParams.filters)) {
        if (Array.isArray(value)) {
            if (value.length > 0) params[`filter[${key}]`] = value;
        } else if (value !== '' && value !== undefined) {
            params[`filter[${key}]`] = value;
        }
    }
    if (legalEntityPublicIds.length > 0) {
        params['legal_entity_public_ids[]'] = [...legalEntityPublicIds];
    }
    const { data } = await api.get<NoteListResponse>(
        noteApiRoute(),
        { params, signal },
    );
    return data;
}

export function noteListQueryOptions(
    tenantId: string,
    legalEntityPublicIds: readonly string[],
    listParams: ResourceListParams,
) {
    const resourceContextId = false ? legalEntityPublicIds.join(',') : tenantId;

    return queryOptions({
        queryKey: [
            ...noteListQueryScope(tenantId, resourceContextId),
            listParams,
        ],
        queryFn: ({ signal }) =>
            fetchNoteList(
                legalEntityPublicIds,
                listParams,
                signal,
            ),
    });
}


/** Shared deletion and cache ownership for list and record Inspectors. */
export function useNoteDelete(tenantId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(noteApiRoute(id));
        },
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({
                queryKey: noteDetailQueryOptions(tenantId, deletedId).queryKey,
                exact: true,
            });
            void queryClient.invalidateQueries({ queryKey: ['submission-proof-notes', tenantId] });
        },
    });
}
