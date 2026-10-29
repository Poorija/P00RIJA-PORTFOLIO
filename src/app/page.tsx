"use client";

import dynamic from "next/dynamic";
import { CustomCursor } from "@/components/portfolio/custom-cursor";
import { ScrollProgress } from "@/components/portfolio/scroll-progress";
import { SiteHeader } from "@/components/portfolio/site-header";
import { ConnectionThread } from "@/components/portfolio/connection-thread";
import { SiteFooter } from "@/components/portfolio/site-footer";
import { ContentBoot } from "@/components/portfolio/content-boot";
const CmsPanel = dynamic(() => import("@/components/portfolio/cms-panel").then((m) => ({ default: m.CmsPanel })), { ssr: false });
import { FlowBackground } from "@/components/portfolio/flow-background";
import { LoginModal } from "@/components/portfolio/login-modal";
import { SectionDetector } from "@/components/portfolio/section-detector";
import { BackToTop } from "@/components/portfolio/back-to-top";
import { CmsRuntimeController } from "@/components/portfolio/cms-runtime-controller";
import { PortfolioSectionStack } from "@/components/portfolio/portfolio-section-stack";
import { ProfileModal } from "@/components/portfolio/profile-modal";
import { EasterEggManager } from "@/components/portfolio/easter-eggs";
const AchievementsPanel = dynamic(() => import("@/components/portfolio/achievements").then((m) => ({ default: m.AchievementsPanel })), { ssr: false });
import { PageLoader } from "@/components/portfolio/page-loader";
import { AnimModeController } from "@/components/portfolio/anim-mode-controller";
import { SpaceComets } from "@/components/portfolio/space-comets";
const MusicPlayer = dynamic(() => import("@/components/portfolio/music-player").then((m) => ({ default: m.MusicPlayer })), { ssr: false });
import { GameCenterOverlay } from "@/components/portfolio/game-center";
import { VisitorTracker } from "@/components/portfolio/visitor-tracker";
import { AssetPreloader } from "@/components/portfolio/asset-preloader";
import { ExternalAnalytics } from "@/components/portfolio/external-analytics";
import { CookieConsent } from "@/components/portfolio/cookie-consent";
const PixelBuddy = dynamic(() => import("@/components/portfolio/pixel-buddy").then((m) => ({ default: m.PixelBuddy })), { ssr: false });
const ExplorerPassport = dynamic(() => import("@/components/portfolio/explorer-passport").then((m) => ({ default: m.ExplorerPassport })), { ssr: false });
const GsapScrollEffects = dynamic(() => import("@/components/portfolio/gsap-scroll-effects").then((m) => ({ default: m.GsapScrollEffects })), { ssr: false });
import { SmoothScroll } from "@/components/portfolio/smooth-scroll";
import { SectionGuardShell } from "@/components/portfolio/section-guard";
import { GuardActivityWatcher } from "@/components/portfolio/guard-activity-watcher";
import { useContent } from "@/lib/content-store";

export default function Home() {
  const lang = useContent((s) => s.lang);
  const footerLabel = useContent((s) => s.content.footer.title);
  return (
    <ContentBoot>
      <AnimModeController>
        <PageLoader />
        <SmoothScroll />
        <div className="relative flex min-h-screen flex-col">
        <FlowBackground />
        <SpaceComets />
        <CmsRuntimeController />
        <SectionDetector />
        <GuardActivityWatcher />
        <CustomCursor />
        <ScrollProgress />
        <SiteHeader />
        <ConnectionThread />

        <main id="main-content" className="portfolio-main relative z-10 flex-1">
          <PortfolioSectionStack />
        </main>

        <SectionGuardShell target="footer" label={footerLabel || (lang === "fa" ? "پاورقی" : "Footer")}>
          <SiteFooter />
        </SectionGuardShell>
        <CmsPanel />
        <LoginModal />
        <BackToTop />
        <ProfileModal />
        <EasterEggManager />
        <AchievementsPanel />
        <MusicPlayer />
        <GameCenterOverlay />
        <VisitorTracker />
        <AssetPreloader />
        <ExternalAnalytics />
        <CookieConsent />
        <PixelBuddy />
        <ExplorerPassport />
        <GsapScrollEffects />
        </div>
      </AnimModeController>
    </ContentBoot>
  );
}
