/* eslint-disable @next/next/no-html-link-for-pages */
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import DarkModeToggle from './dark_mode_toggle';

const my_nav_objs: { name: string, link: string }[] = [
    { name: "Home", link: "/" },
    { name: "Blog", link: "/blogs" },
    { name: "About", link: "/about" },
];

export default function CommonHeader() {
    return (
        <header>
            <div className="flex flex-row p-1 gap-4 border-b-4 dark:border-stone-800 border-stone-400 h-16 items-center justify-between">
                <div className="justify-start flex flex-row p-2 gap-4 items-center">
                    {my_nav_objs.map((nav_obj) => (
                        <Link key={nav_obj.name} href={nav_obj.link} className="text-stone-600 hover:text-stone-800 dark:text-stone-400 hover:dark:text-stone-200">{nav_obj.name}</Link>
                    ))}
                </div>
                <div className="p-2"><DarkModeToggle/></div>
            </div>
        </header>
    )
}
