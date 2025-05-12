import axios from "axios";

const options = {
  method: 'POST',
  url: 'https://gmailnator.p.rapidapi.com/generate-email',
  headers: {
    'x-rapidapi-key': 'c779f79723msh012842f19d2b437p122ab1jsn7b73636f2bd8',
    'x-rapidapi-host': 'gmailnator.p.rapidapi.com',
    'Content-Type': 'application/json'
  },
  data: {options: [1, 2, 3]}
};

export async function fetchData() {
	try {
		const response = await axios.request(options);
		console.log(response.data);
        return response.data['email'];
	} catch (error) {
		console.error(error);
	}
}

fetchData();