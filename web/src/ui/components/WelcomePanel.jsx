import { useEffect, useState } from "react";

const KEY = "fieldshift-welcome-seen";

function alreadySeen() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** First-visit "how to use" dialog, centred over a blurred page. Dismissed once
 * (button, ×, Esc or a click outside), remembered in this browser. */
export default function WelcomePanel({ t, onSetup }) {
  const [open, setOpen] = useState(() => !alreadySeen());
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: it shows again next visit */
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="welcome-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
    <aside className="welcome" role="dialog" aria-modal="true" aria-label={t("welcome_h")}>
      <button className="welcome-x" onClick={close} aria-label={t("welcome_close")}>
        ×
      </button>
      <h3>{t("welcome_h")}</h3>
      <ol>
        <li>{t("welcome_1")}</li>
        <li>{t("welcome_2")}</li>
        <li>{t("welcome_3")}</li>
      </ol>
      <div className="welcome-actions">
        <button
          className="welcome-go"
          onClick={() => {
            close();
            onSetup();
          }}
        >
          {t("welcome_go")}
        </button>
        <button className="welcome-skip" onClick={close}>
          {t("welcome_later")}
        </button>
      </div>
    </aside>
    </div>
  );
}
