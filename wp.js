const fs = require('fs');
const WPAPI = require('wpapi');
const axios = require('axios');

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const wp = new WPAPI({ endpoint: `${process.env.HOST_API}/wp-json` });

function setWpHeaders() {
  console.log(getJWTToken());
  wp.setHeaders('Authorization', `Bearer ${getJWTToken()}`);
}
function getJWTToken() {
  return fs.readFileSync('jwt_token', 'utf8');
}
async function saveJWTToken(HOST_API, username, password) {
  try {
    // Request a JWT token
    const response = await axios.post(`${HOST_API}/wp-json/jwt-auth/v1/token`, {
      username,
      password
    });

    if (response.data.token) {
      fs.writeFileSync('jwt_token', `${response.data.token}`);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function checkValidJWTToken() {
  try {
    const response = await axios.post(`${process.env.HOST_API}/wp-json/jwt-auth/v1/token/validate`, {}, {
      headers: {
        Authorization: `Bearer ${getJWTToken()}`
      }
    });

    if (response.data.data.status === 403) {
      return false;
    }
    return response.data.data.status === 200;
  } catch (error) {
    // console.error('An error occurred:', error);
  }

}


function getOrCreateTaxonomy(taxonomy, name) {
  return taxonomy.search(name).then(items => {
    if (items.length > 0) {
      // If the item exists, return its ID
      return items[0].id;
    } else {
      // If the item doesn't exist, create it and return its ID
      const slug = name.toLowerCase().replace(/ /g, '-');
      return taxonomy.create({ name, slug }).then(item => item.id);
    }
  });
}

async function createPost(title, content, categoryNames, tagNames, embed, imagePath, postViewsCount) {
  try {
    // Upload the image and get the media item
    const media = await wp.media().file(imagePath).create();

    // Get the image link
    const thumb = media.source_url;
    // Get the image ID
    const featured_media = media.id;
    console.log(thumb);
    // Get or create the categories and tags
    const categoryIds = await Promise.all(categoryNames.map(name => getOrCreateTaxonomy(wp.categories(), name)));
    const tagIds = await Promise.all(tagNames.map(name => getOrCreateTaxonomy(wp.tags(), name)));

    // Create the post with the category and tag IDs, the meta, and the image link
    const post = await wp.posts().create({
      title,
      content,
      // status: 'draft',
      status: 'publish',
      categories: categoryIds,
      tags: tagIds,
      featured_media,
      meta: {
        embed: embed,
        thumb: thumb,
        post_views_count: postViewsCount
      }
    });

    console.log('Đa post bai xong ID:', post.id);
  } catch (err) {
    console.error('An error occurred:', err);
  }
}
let allPosts = [];

function getAllPosts(page = 1) {
  return wp.posts().perPage(100).page(page).get()
    .then(posts => {
      allPosts = allPosts.concat(posts);
      console.log('Fetched page: ', page);
      if (posts.length === 100) {
        // If we received 100 posts, there might be more posts in the next page.
        return getAllPosts(page + 1);
      } else {
        // If we received less than 100 posts, we've fetched all posts.
        return allPosts;
      }
    });
}

async function createPostWithValidToken(title, content, categoryNames, tagNames, embed, thumb, postViewsCount) {
  const isValid = await checkValidJWTToken();
  if (!isValid) {
    await saveJWTToken(process.env.HOST_API, process.env.USERNAMEV, process.env.PASSWORD);
  }
  setWpHeaders();
  await createPost(title, content, categoryNames, tagNames, embed, thumb, postViewsCount);
}

module.exports = {createPostWithValidToken}
