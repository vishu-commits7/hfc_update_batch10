import { LANGS, useLang, useT } from "../i18n";

/** English / Hindi switch. Each choice is shown in its own language so it can be found without reading the current one. */
export default function LanguageSwitch({ className = "" }: { className?: string }) {
  const [lang, setLang] = useLang();
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("lang.aria")} className={`inline-flex rounded-xl bg-graphite p-0.5 ${className}`}>
      {LANGS.map(l => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          lang={l.code}
          onClick={() => setLang(l.code)}
          className={`min-h-[44px] rounded-[10px] px-3 text-xs font-bold ${lang === l.code ? "bg-volt text-void" : "text-ink-2"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
