import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gamepad2, Swords, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";

function ArenaGamerSection() {
  return (
    <section
      id="arena-gamer"
      aria-labelledby="arena-gamer-title"
      className="relative overflow-hidden border-b border-white/8 bg-[#0d0e16] px-5 py-16 sm:px-8 sm:py-20"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgb(106_0_255/18%),transparent_34rem),radial-gradient(circle_at_88%_24%,rgb(255_46_209/10%),transparent_28rem)]"
      />
      <Image
        src="/images/arcane_jinx_render_by_danic574_dfaacno-fullview.png"
        alt=""
        width={1280}
        height={1796}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-[-2rem] z-20 hidden h-auto w-[19rem] drop-shadow-[0_20px_35px_rgb(0_0_0/55%)] select-none 2xl:block"
      />
      <Image
        src="/images/chamber.png"
        alt=""
        width={724}
        height={469}
        aria-hidden
        className="pointer-events-none absolute right-[-2.5rem] bottom-0 z-20 hidden h-auto w-[29rem] drop-shadow-[0_20px_35px_rgb(0_0_0/55%)] select-none 2xl:block"
      />

      <div className="relative z-10 mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-cyan-electric/20 bg-[#111329]/90 shadow-[0_28px_90px_rgb(0_0_0/35%)] lg:grid-cols-[1.08fr_.92fr]">
        <div className="flex flex-col justify-center p-7 sm:p-9 lg:p-10">
          <p className="flex items-center gap-2 font-display text-xs font-semibold tracking-[.2em] text-cyan-electric uppercase sm:text-sm">
            <Gamepad2 className="size-4" aria-hidden />
            Arena Gamer
          </p>
          <h2
            id="arena-gamer-title"
            className="mt-4 max-w-xl text-balance font-display text-3xl leading-tight font-semibold text-ice-white sm:text-4xl"
          >
            Entre na disputa da Arena Gamer
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-blue-gray sm:text-base">
            LoL e Valorant em times de cinco (máximo 10 times por jogo). Free
            Fire em inscrição individual. Participe da Arena Gamer da SNCT
            Paulista.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-vibrant/30 bg-purple-vibrant/10 px-3 py-2 text-xs text-[#D6C8FF]">
              <Swords className="size-4" aria-hidden /> LoL/Valorant: até 10 times
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-magenta-neon/25 bg-magenta-neon/10 px-3 py-2 text-xs text-[#FFC2F2]">
              <Trophy className="size-4" aria-hidden /> Free Fire: individual
            </span>
          </div>

          <div
            className="mt-6 grid grid-cols-3 items-center gap-4 sm:gap-6"
            aria-label="Jogos disponíveis"
          >
            {[
              {
                src: "/images/League-of-Legends-Logo.png",
                alt: "League of Legends",
              },
              {
                src: "/images/Valorant-Logo-PNG-Cutout.png",
                alt: "Valorant",
              },
              {
                src: "/images/free-fire-logo-0.png",
                alt: "Free Fire",
              },
            ].map((game) => (
              <div
                key={game.alt}
                className="grid min-h-20 place-items-center"
              >
                <Image
                  src={game.src}
                  alt={`Logotipo ${game.alt}`}
                  width={240}
                  height={120}
                  className="max-h-20 w-auto max-w-full object-contain sm:max-h-24"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center border-t border-cyan-electric/15 bg-[#080914] lg:border-t-0 lg:border-l">
          <Image
            src="/images/ARENAGAMER.png"
            alt="Arte oficial completa da Arena Gamer da SNCT Paulista"
            width={1122}
            height={1402}
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="h-auto w-full object-contain"
          />
          <div className="p-4 sm:p-5">
            <Button
              size="lg"
              variant="glow"
              className="w-full shadow-[0_12px_35px_rgb(0_229_255/20%)]"
              render={<Link href="/auth/inscricao/arena" />}
            >
              Inscrever-me na Arena
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export { ArenaGamerSection };
