/* eslint-disable @next/next/no-html-link-for-pages */
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import DarkModeToggle from './dark_mode_toggle';

const my_nav_objs: { name: string, link: string }[] = [
    { name: "Home", link: "/" },
    { name: "About", link: "/about" },
    { name: "Blog", link: "/blog" }
];
export default function CommonHeader() {
    return (
        <header>
            <div className="flex flex-row p-1 gap-4 bg-stone-300 dark:bg-stone-900 border-b-4 border-sky-800 h-16 items-center justify-between">
                <div className="justify-start flex flex-row p-2 gap-4 items-center">
                    {my_nav_objs.map((nav_obj) => (
                        <Link key={nav_obj.name} href={nav_obj.link} className="text-stone-800 hover:text-stone-600 dark:text-stone-200 hover:dark:text-stone-400">{nav_obj.name}</Link>
                    ))}
                </div>
                <div className="p-2"><DarkModeToggle/></div>
            </div>
        </header>
    )
}
