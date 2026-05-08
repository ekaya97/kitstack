import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum",
};

export default function ImprintPage() {
  return (
    <>
      <div className="mb-10">
        <div className="font-mono text-[11px] text-ks-muted tracking-wider uppercase mb-3">
          Legal
        </div>
        <h1>Impressum</h1>
      </div>

      <h2>Angaben gem&auml;&szlig; &sect; 5 TMG</h2>
      <p>
        Enes Kaya
        <br />
        Vagedesstr. 21
        <br />
        40479 Düsseldorf
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail:{" "}
        <a href="mailto:hello@kitstack.co">hello@kitstack.co</a>
      </p>

      <h2>Umsatzsteuer-Identifikationsnummer</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gem&auml;&szlig; &sect; 27 a
        Umsatzsteuergesetz:
        <br />
        [USt-IdNr.]
      </p>

      <h2>Verantwortlich f&uuml;r den Inhalt nach &sect; 55 Abs. 2 RStV</h2>
      <p>
        Enes Kaya
        <br />
        [Adresse wie oben]
      </p>

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europ&auml;ische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{" "}
        <a
          href="https://ec.europa.eu/consumers/odr/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ec.europa.eu/consumers/odr
        </a>
        . Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>

      <h2>
        Verbraucherstreitbeilegung / Universalschlichtungsstelle
      </h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>

      <div className="mt-16 pt-6 border-t border-ks-hair">
        <p className="!text-ks-faint !text-xs">
          Bitte ersetzen Sie die Platzhalter [in eckigen Klammern] durch Ihre
          tats&auml;chlichen Angaben vor der Ver&ouml;ffentlichung.
        </p>
      </div>
    </>
  );
}
