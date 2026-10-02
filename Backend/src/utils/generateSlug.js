import Therapist from '../models/Therapist.js';

const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.\s_]+/g, '-')        
    .replace(/[^a-z0-9-]/g, '')      
    .replace(/-+/g, '-')             
    .replace(/^-|-$/g, '');          
};
const generateUniqueSlug = async (name) => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  while (await Therapist.findOne({ slug })) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
};

export default generateUniqueSlug;