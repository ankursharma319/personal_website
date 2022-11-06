import Head from 'next/head'
import Image from 'next/image'

export default function CommonFooter() {
  return (
      <footer className="flex flex-row justify-center p-2">
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
          className='text-stone-600 dark:text-stone-400'
        >
          Powered by{' '}
          <span>
            <Image src="/vercel.svg" alt="Vercel Logo"
            width={72} height={16} className="opacity-60 dark:invert m-1"/>
          </span>
        </a>
      </footer>
  )
}
