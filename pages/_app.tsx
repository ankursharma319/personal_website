import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react';
import { ThemeContext } from '../components/theme_context';
import { Analytics } from '@vercel/analytics/react';

function setCookie(cname:string, cvalue:string, exdays:number) {
  if(typeof document == 'undefined') {
    return;
  }
  const d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname:string|null) {
  if(typeof document == 'undefined') {
    return null;
  }
  return document?.cookie
  ?.split('; ')
  .find((row) => row.startsWith(cname+'='))
  ?.split('=')[1];
}

export default function App({ Component, pageProps }: AppProps) {
  const initial_theme = "dark";
  const [theme, setTheme] = useState(initial_theme);
  function setThemeAndUpdateCookie(theme:string) {
      setTheme(theme);
      setCookie("theme", theme, 30);
  }
  const props_to_pass = {...pageProps, setTheme: setThemeAndUpdateCookie};

  useEffect(()=>{
    const current_theme = getCookie("theme") ?? "dark";
    setThemeAndUpdateCookie(current_theme);
  });

  return <>
  <ThemeContext.Provider value={theme}>
    <Component {...props_to_pass} />
    <Analytics/>
  </ThemeContext.Provider>
  </>
}
