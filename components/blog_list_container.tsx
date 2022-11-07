import Link from "next/link";
import { BlogPostMetadata } from "../utils/load_blogs";
import BlogListCard from "./blog_list_card";

export default function BlogListContainer({blogPostsMetadata}:{blogPostsMetadata:BlogPostMetadata[]}) {
    return <>
    <div className="flex flex-col gap-8 justiy-start justify-items-center content-center w-full">
    { blogPostsMetadata.map((metadata:BlogPostMetadata, index:number) =>(
        <BlogListCard key={metadata.id} blogPostMetadata={metadata}/>
    ))}
    </div>
    </>
}
