import { Helmet } from 'react-helmet-async';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(35,20%,93%)] dark:bg-[hsl(25,8%,9%)]">
      <Helmet>
        <title>404 - Page Not Found | BharatViz</title>
        <meta name="title" content="404 - Page Not Found | BharatViz" />
        <meta name="description" content="The page you're looking for doesn't exist. Return to BharatViz to create beautiful choropleth maps of India." />
        <meta name="robots" content="noindex, nofollow" />

        <meta property="og:type" content="website" />
        <meta property="og:title" content="404 - Page Not Found | BharatViz" />
        <meta property="og:description" content="The page you're looking for doesn't exist. Return to BharatViz to create beautiful choropleth maps of India." />
        <meta property="og:site_name" content="BharatViz" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="404 - Page Not Found | BharatViz" />
        <meta name="twitter:description" content="The page you're looking for doesn't exist." />
      </Helmet>
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">404</h1>
        <p className="text-xl mb-4 text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">Oops! Page not found</p>
        <a href="/" className="text-[hsl(28,55%,42%)] hover:text-[hsl(28,48%,32%)] underline dark:text-[hsl(35,55%,60%)] dark:hover:text-[hsl(35,48%,72%)]">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
