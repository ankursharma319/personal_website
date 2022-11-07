import Head from "next/head";
import Link from "next/link";

export default function MyErrorPage({ error_code, description }: { error_code: number, description: string }) {
    return <>
        <Head>
            <title>Ankurs Blog</title>
            <meta name="description" content="Ankur's personal website with a blog about random topics in software development, mainly C++ and Linux." />
            <meta name="keywords" content="blog ankur software c++ c linux" />
            <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
            <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
            <link rel="manifest" href="/site.webmanifest" />
        </Head>

        <div className='flex flex-row justify-center items-center bg-stone-900 text-stone-300'>
            <main className="flex flex-col justify-center items-center min-h-screen max-w-screen-lg">
                <h1 className="text-6xl">{error_code} </h1>
                <br />
                <h2 className="text-2xl">{description}</h2>
                <Link href="/"><h2 className="text-2xl hover:text-stone-500">Go to home</h2></Link>
            </main>
        </div>
    </>
}
