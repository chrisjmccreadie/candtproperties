const superagent = require("superagent");

const getData = async (env, theUrl) => {
  const res = await superagent.get(theUrl).query({});
  return res.body;
};

/**
 * Fetches data from a remote source, categorizes it based on tags,
 * and returns an object containing categorized data.
 *
 * This function makes an asynchronous call to fetch data, which is
 * then processed to separate items into categories based on their tags.
 * Items tagged as "work" are added to the `workData` array, and items
 * tagged as "services" are added to the `servicesData` array. The
 * categorized data is then stored in the `apiData` object, which is
 * returned by the function.
 *
 * @returns {Promise<Object>} A promise that resolves to an object with
 *                            categorized `apiData` containing `work`
 *                            and `services` arrays.
 */

module.exports = async (env) => {
  let apiData = [];
  let tempData;
  let workData = [];

  /*
  //get the work
  tempData = await getData(env, `${env.CMSURL}\work`);
  tempData.data.forEach((item) => {
    //add to the array
    workData.push(item);
  });
  */

  // Assign categorized data to apiData
  apiData.work = workData;
  //debug
  //console.log(apiData);

  // api data to return
  return {
    apiData,
  };
};
