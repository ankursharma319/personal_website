import Head from 'next/head'
import Image from 'next/image'
import CommonFooter from '../components/common_footer'
import CommonHeader from '../components/common_header'

export default function MainLayout({children}:{children:any}) {
  return (
    <div className='dark'>
    <Head>
    <title>Ankurs Blog</title>
    <meta name="description" content="Ankur's personal website with a blog about random topics in software development, mainly C++ and Linux." />
    <meta name="keywords" content="blog ankur software c++ c linux"/>
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/>
    <link rel="manifest" href="/site.webmanifest"/>
    </Head>

    <div className=" bg-stone-200 dark:bg-stone-800 dark:text-stone-200 text-stone-800 flex flex-col min-h-screen">

      <CommonHeader/>
      <main className='flex-grow'>
        <h1>
          Welcome to <a href="https://nextjs.org">Next.js!</a>
        </h1>
        <p>Some more content here - todo</p>
        {children}
      </main>
      <CommonFooter/>

    </div>
    </div>
  )
}
