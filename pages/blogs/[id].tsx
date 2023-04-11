import MainLayout from '../../components/main_layout'
import { BlogPostData, getAllBlogIds, getBlogPost } from '../../utils/load_blogs';
import 'highlight.js/styles/tokyo-night-dark.css';

export async function getStaticPaths() {
    const paths = getAllBlogIds();
    return {
        paths,
        fallback: false,
    };
}

export async function getStaticProps({ params }: { params: any }) {
    const postData = await getBlogPost(params.id);
    return {
        props: {
            blogPostData: postData,
        },
    };
}

function toReadableDate(date:string): string {
    return date;
}

function TagsView({tags}:{tags:string[]}) {
    return <div className='flex flex-row justify-start gap-2'>
        {tags.map((tag, index) => (
            <div className="p-2 bg-stone-400 dark:bg-stone-700 text-sm" key={tag}>{tag}</div>
        ))}
    </div>
}

function TitleSection({blogPostData}: {blogPostData:BlogPostData}) {
    return <div className='flex flex-col justify-start items-start content-start w-full border-b-2 border-stone-400 dark:border-stone-700'>
    <div className="prose prose-stone lg:prose-xl dark:prose-invert">
    <h1>{blogPostData.title}</h1>
    <h3>{blogPostData.description}</h3>
    <p className='text-stone-600 dark:text-stone-400 text-lg'>
        By {blogPostData.author}
        <br/>
        Published {toReadableDate(blogPostData.date)}
    </p>
    <TagsView tags={blogPostData.keywords}/>
    <br/>
    </div>
    </div>
}

export default function BlogPostView(props: { blogPostData: BlogPostData }) {
    return (
        <MainLayout title={props.blogPostData.title}
            description={props.blogPostData.description}
            keywords={props.blogPostData.keywords.join(" ")}
        >
            <div className='flex flex-col justify-start items-start content-start min-h-full w-full gap-8 py-2'>
                <TitleSection blogPostData={props.blogPostData}/>
                <article className="prose prose-stone lg:prose-xl dark:prose-invert marker:text-stone-400 dark:marker:text-stone-500 prose-blockquote:border-stone-400 dark:prose-blockquote:border-stone-500">
                    <div dangerouslySetInnerHTML={{ __html: props.blogPostData.html_content }} />
                </article>
            </div>
        </MainLayout>
    )
}
