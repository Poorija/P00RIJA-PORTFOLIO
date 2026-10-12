import { CmsPanel } from "@/components/portfolio/cms-panel";
import { CmsRuntimeController } from "@/components/portfolio/cms-runtime-controller";
import { ContentBoot } from "@/components/portfolio/content-boot";
import { CustomCursor } from "@/components/portfolio/custom-cursor";
import { FlowBackground } from "@/components/portfolio/flow-background";
import { LoginModal } from "@/components/portfolio/login-modal";
import { NotFoundSpaceGame } from "@/components/portfolio/not-found-space-game";

export default function NotFound() {
  return (
    <ContentBoot>
      <FlowBackground />
      <CmsRuntimeController />
      <CustomCursor />
      <NotFoundSpaceGame />
      <CmsPanel />
      <LoginModal />
    </ContentBoot>
  );
}
