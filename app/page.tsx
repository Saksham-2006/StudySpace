
import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import About from "@/components/home/About";
import SpaceCategories from "@/components/home/SpaceCategories";
import HowItWorks from "@/components/home/HowItWorks";
import Gallery from "@/components/home/Gallery";
import Venue from "@/components/home/Venue";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <About />
        <SpaceCategories />
        <Venue />
        <HowItWorks />

        {/* Add your booking/pricing section here */}

        <Gallery />
      </main>
    </>
  );
}
