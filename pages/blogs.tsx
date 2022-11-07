import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import MainLayout from '../components/main_layout'
import { BlogPostMetadata, getAllBlogPostsMetadatOnly } from '../utils/load_blogs'
import BlogListContainer from '../components/blog_list_container'

export default function BlogListPage({ blogPostsMetadata }: { blogPostsMetadata: BlogPostMetadata[] }) {
    return (
        <MainLayout title='Ankurs Blog'
            description="Ankur's personal website with a blog about random topics in software development, mainly C++ and Linux."
            keywords="blog ankur software c++ c linux"
        >
            <div className='flex flex-col justify-start items-start min-h-full'>
                <h1 className='text-4xl'>Blog posts</h1>
                <br />
                <BlogListContainer blogPostsMetadata={blogPostsMetadata} />
            </div>
        </MainLayout>
    )
}

export async function getStaticProps({ params }: { params: any }) {
    const postsData: BlogPostMetadata[] = await getAllBlogPostsMetadatOnly();
    return {
        props: {
            blogPostsMetadata: postsData,
        },
    };
}
