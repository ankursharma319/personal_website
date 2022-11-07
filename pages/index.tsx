import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import MainLayout from '../components/main_layout'
import StockPic from '../public/images/pexels-lumn.png'

export default function Home(props: any) {
  return (
    <MainLayout setTheme={props.setTheme}>
      <div className='flex flex-col justify-start items-start min-h-full'>
      <br/>
      <span className='rounded-lg'>
        <Image src={StockPic} alt="A paved road in woods" width={400} className="rounded"/>
      </span>
      <div className=''>
        <br/>
        <br/>
        <h1 className='text-6xl'>Hi I&apos;m <span className='dark:text-indigo-500 text-indigo-600'>Ankur!</span></h1>
        <br/>
        <br/>
        <h2 className='text-2xl'>I am a software engineer</h2>
        <br/>
        <p> Here I blog about random topics including C/C++, Linux, etc. Much of what I post is essentially notes I made for myself while exploring a topic or a problem and would like to help others by sharing.</p>
        <br/>
        <Link href="/about" className='bg-indigo-300 hover:bg-indigo-400 dark:bg-indigo-900 dark:hover:bg-indigo-800 rounded p-3'>Hire me!</Link>
      </div>
      </div>
    </MainLayout>
  )
}
