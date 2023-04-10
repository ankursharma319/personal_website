import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const blogsDirectory = path.join(process.cwd(), 'blogs');
const metadataDirectory = path.join(process.cwd(), 'blogs', 'metadata');

export interface BlogPostMetadata {
    id: string,
    title: string,
    description: string,
    date: string,
    author: string,
    keywords: string[],
    category: string,
    cover_image_url: string,
}

export type BlogPostData = BlogPostMetadata & {html_content: string}

export async function getBlogPost(name: string): Promise<BlogPostData> {
    const fullPath = path.join(blogsDirectory, name + ".md");
    const md_content = fs.readFileSync(fullPath, 'utf8');

    // Use marked to convert markdown into HTML string
    const html_content = marked.parse(md_content);

    const metadata_path: string = path.join(metadataDirectory, name + '.json');
    const metadata_str: string = fs.readFileSync(metadata_path, 'utf-8');
    const metadata: BlogPostMetadata = JSON.parse(metadata_str);

    return {
        id: metadata.id,
        title: metadata.title,
        description: metadata.description,
        author: metadata.author,
        keywords: metadata.keywords,
        date: metadata.date,
        category: metadata.category,
        cover_image_url: metadata.cover_image_url,
        html_content: html_content,
    };
}

interface BlogIdEntry {
    params: {id: string}
}

export function getAllBlogIds() : BlogIdEntry[] {
    const fileNames = fs.readdirSync(metadataDirectory);
    // Returns an array that looks like this:
    // [
    //   {
    //     params: {
    //       id: 'ssg-ssr'
    //     }
    //   },
    //   {
    //     params: {
    //       id: 'pre-rendering'
    //     }
    //   }
    // ]
    return fileNames.map((fileName) => {
      return {
        params: {
          id: fileName.replace(/\.json$/, ''),
        },
      };
    });
}


export async function getAllBlogPostsMetadatOnly(): Promise<BlogPostMetadata[]> {
    const blog_ids = getAllBlogIds();
    const blog_posts_metadatas = blog_ids.map((blog_id_entry) => {
        const metadata_path: string = path.join(metadataDirectory, blog_id_entry.params.id + '.json');
        const metadata_str: string = fs.readFileSync(metadata_path, 'utf-8');
        const metadata: BlogPostMetadata = JSON.parse(metadata_str);
        return metadata;
    });

    function compare_blog_by_date( a: BlogPostMetadata, b: BlogPostMetadata ) {
        if ( a.date < b.date ){
          return -1;
        }
        if ( a.date > b.date ){
          return 1;
        }
        return 0;
      }

    blog_posts_metadatas.sort(compare_blog_by_date);

    return blog_posts_metadatas;

}
