
import { getRepoCreationDate } from './repo.js';

getRepoCreationDate('edddro', 'JudgeJam', 'https://dorahacks.io/buidl/23021', '2025-05-14T09:40')
    .then(result => {
        console.log(JSON.stringify(result));
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
