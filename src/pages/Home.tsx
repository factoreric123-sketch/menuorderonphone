import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import Navbar from "@/components/home/Navbar";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import DemoPreviewSection from "@/components/home/DemoPreviewSection";
import StatsSection from "@/components/home/StatsSection";
import TrustSection from "@/components/home/TrustSection";
import CTASection from "@/components/home/CTASection";
import Footer from "@/components/home/Footer";

const Home = () => {
  useDocumentTitle("Beautiful Digital Menus for Restaurants", "Create stunning digital menus in minutes. QR codes, allergen filters, drag-and-drop editor. No coding required.");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const scrollTo = searchParams.get("scrollTo");
    if (scrollTo) {
      setTimeout(() => {
        const element = document.getElementById(scrollTo);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
        searchParams.delete("scrollTo");
        setSearchParams(searchParams, { replace: true });
      }, 100);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <DemoPreviewSection />
      <StatsSection />
      <TrustSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Home;
