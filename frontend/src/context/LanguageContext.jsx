import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'zh', label: '中文',    short: '中' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
];

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem('app_lang') || 'en'
  );

  const changeLang = (code) => {
    setLang(code);
    localStorage.setItem('app_lang', code);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
