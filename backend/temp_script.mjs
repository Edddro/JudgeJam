
import { getRepoCreationDate } from './repo.js';

getRepoCreationDate('Edddro', 'JudgeJam', 'https://devpost.com/software/homesafe-73n0f2', '2025-04-28T11:53')
    .then(result => {
        console.log(JSON.stringify(result));
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
