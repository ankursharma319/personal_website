import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import MainLayout from '../components/main_layout'

export default function AboutPage() {
    return (
        <MainLayout title='About Ankur'
            description="Details about Ankur Sharma (the author of the website) and how to get in touch!"
            keywords="about contact engineer developer hire"
        >
            <div className='flex flex-col justify-start items-start min-h-full'>
                <h1 className='text-4xl'>About me!</h1>
                <br />
                <p>
                    I am a Software Engineer at Cisco, experienced in embedded systems development.
                    I also have experience in fullstack web development, and machine learning.

                    I love to keep learning and growing. As a result, I have gathered knowledge in a breadth of topics!
                    Jack of all trades, master of none (maybe one 😉)!
                </p>
                <br/>
                <p>Checkout the <Link href="/projects"
                        className='text-indigo-600 hover:text-indigo-700 dark:text-indigo-500  dark:hover:text-indigo-600'
                    >public projects</Link> which I have done.</p>
                <br/>
                <p>
                    Reach out to me on <Link href="https://www.linkedin.com/in/ankur-sharma-449660109/"
                        className='text-indigo-600 hover:text-indigo-700 dark:text-indigo-500  dark:hover:text-indigo-600'
                    >LinkedIn</Link> if you have any questions!
                </p>
            </div>
        </MainLayout>
    )
}
