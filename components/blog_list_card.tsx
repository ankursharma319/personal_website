import Link from "next/link";
import Image from "next/image";
import { BlogPostMetadata } from "../utils/load_blogs";

function short_date(date: string): string {
    const segments = date.split("-");
    return segments[0] + "-" + segments[1];
}

export default function BlogListCard({ blogPostMetadata }: { blogPostMetadata: BlogPostMetadata }) {
    return <div className="rounded-lg border-2 border-stone-400 dark:border-stone-800 w-full p-2">
        <div className="flex flex-row gap-2 justify-start content-center items-center">
            <div className="bg-indigo-400 dark:bg-indigo-800 rounded-md relative hidden md:inline md:w-36 md:h-24 shrink-0 grow-0">
                {blogPostMetadata.cover_image_url ?
                    <Image
                        src={blogPostMetadata.cover_image_url} alt={blogPostMetadata.category}
                        fill className="rounded-md"
                    />
                    : <div className="flex flex-row justify-center content-center items-center w-full h-full">
                        <h2 className="text-2xl">{blogPostMetadata.category}</h2>
                    </div>
                }
            </div>
            <div className="grow flex flex-col justify-center items-start gap-2 p-2">
                <Link href={'/blogs/' + blogPostMetadata.id}>
                    <h1 className="text-2xl hover:text-stone-700 dark:hover:text-stone-400">{blogPostMetadata.title}</h1>
                </Link>
                <p className="text-stone-700 dark:text-stone-400">{blogPostMetadata.description}</p>
            </div>
            <div className="grow-0 shrink-0 p-2 w-18">
                <p>{short_date(blogPostMetadata.date)}</p>
            </div>
        </div>
    </div>
}
