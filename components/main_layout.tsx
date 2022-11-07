import Head from 'next/head'
import Image from 'next/image'
import { useContext, useEffect } from 'react';
import { ThemeContext } from './theme_context';
import CommonFooter from '../components/common_footer'
import CommonHeader from '../components/common_header'

export default function MainLayout({children, setTheme}:{children:any, setTheme:(theme:string)=>void}) {
    
    const theme = useContext(ThemeContext);

    return (
    <div className={theme}>
    <Head>
    <title>Ankurs Blog</title>
    <meta name="description" content="Ankur's personal website with a blog about random topics in software development, mainly C++ and Linux." />
    <meta name="keywords" content="blog ankur software c++ c linux"/>
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/>
    <link rel="manifest" href="/site.webmanifest"/>
    </Head>

    <div className='flex flex-row justify-center  bg-stone-300 dark:bg-stone-900 dark:text-stone-300 text-stone-900'>
    <div className="flex flex-col min-h-screen max-w-screen-lg">
      <CommonHeader setTheme={setTheme}/>
      <main className='flex-grow p-4'>
        {children}
      </main>
      <CommonFooter/>
    </div>
    </div>
    </div>
  )
}
