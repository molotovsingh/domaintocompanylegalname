import { CheerioCrawler } from 'crawlee';

async function testCrawl() {
  console.log('Starting test crawl of example.com');
  
  const pages = [];
  const errors = [];
  
  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: 3,
    requestHandler: async ({ request, response, $ }) => {
      console.log(`Processing: ${request.url}`);
      const html = $.html();
      pages.push({
        url: request.url,
        htmlLength: html.length,
        statusCode: response.statusCode
      });
      console.log(`Success: ${request.url} - HTML length: ${html.length}`);
    },
    failedRequestHandler: async ({ request, error }) => {
      console.log(`Failed: ${request.url} - Error: ${error.message}`);
      errors.push(`${request.url}: ${error.message}`);
    }
  });
  
  console.log('Running crawler...');
  await crawler.run(['https://example.com']);
  
  console.log(`\nCrawl completed. Pages: ${pages.length}, Errors: ${errors.length}`);
  console.log('Pages:', pages);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }
}

testCrawl().catch(console.error);