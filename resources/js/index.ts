import {
    autoRegisterPackageResourceInspectors,
    autoRegisterPackageSurfaces,
} from '@nexia/sdk/host';

autoRegisterPackageResourceInspectors(
    import.meta.glob('./resources/*/inspector/register-*-inspector.ts', { eager: true }),
    import.meta.glob('./resources/*/*-resource-contract.ts', { eager: true }),
);

autoRegisterPackageSurfaces({
    appPrefix: 'SubmissionProof',
    appKey: 'submission-proof',
    overview: () => import('./overview/SubmissionProofOverviewSurface'),
    surfaces: import.meta.glob('./resources/*/surface/*Surface.tsx'),
    resourceContracts: import.meta.glob('./resources/*/*-resource-contract.ts'),
    overrides: {
        // nexia:pages:end
    },
});
