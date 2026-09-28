import { useTranslation } from "react-i18next";
import { AppRouteFrame } from "@nexia/sdk/host";

/** Neutral landing page; published navigation owns the available pages. */
export default function SubmissionProofOverviewSurface() {
    const { t } = useTranslation();

    return (
        <AppRouteFrame
            appKey="submission-proof"
            title={t("submission-proof.overview.title")}
            subtitle={t("submission-proof.overview.subtitle")}
        >
            <p>{t("submission-proof.overview.empty.description")}</p>
        </AppRouteFrame>
    );
}
