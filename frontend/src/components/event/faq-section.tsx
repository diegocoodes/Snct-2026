import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  [
    "O evento é gratuito?",
    "Sim. A participação será gratuita, mediante inscrição e disponibilidade de vagas.",
  ],
  [
    "Preciso fazer inscrição?",
    "Sim. A inscrição gera seu QR Code individual e permite acompanhar as atividades escolhidas.",
  ],
  [
    "Como recebo meu QR Code?",
    "Após a confirmação, seu QR Code seguro ficará disponível e será enviado pelos canais cadastrados.",
  ],
  [
    "Como funciona o check-in?",
    "Apresente seu QR Code no Totem. Após a leitura, ele identificará seu cadastro e imprimirá uma etiqueta com seu nome.",
  ],
  [
    "O local possui acessibilidade?",
    "As informações detalhadas de acesso e os recursos disponíveis serão publicados com a confirmação do local.",
  ],
] as const;

function FAQSection({ showIntro = true }: { showIntro?: boolean }) {
  return (
    <section
      id="faq"
      aria-label="Respostas às perguntas frequentes"
      className="px-5 py-20 sm:px-8 sm:py-24"
    >
      <div
        className={
          showIntro
            ? "mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.7fr_1.3fr]"
            : "mx-auto max-w-4xl"
        }
      >
        {showIntro ? (
          <div>
            <p className="font-display text-sm tracking-[.22em] text-cyan-electric uppercase">
              Perguntas frequentes
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold">
              Informação clara para participar com tranquilidade
            </h2>
          </div>
        ) : null}
        <Accordion className="surface-glass rounded-2xl px-5">
          {faqs.map(([question, answer]) => (
            <AccordionItem key={question} value={question}>
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionContent>{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export { FAQSection };
