(function () {
    let id = document.getElementById("userId");
    let errId = document.getElementById("userIdErr");
    id.addEventListener('blur',async ()=> {
        errId.innerText = "";
        if(id.value  !== "") {
            const response = await fetch("/users?id=" + id.value + "&_json=true", {
                method: 'GET', // *GET, POST, PUT, DELETE, etc.
            });
            let obj = await response.json();
            if (Object.keys(obj).length > 0 && obj.users.length === 0) {
                errId.innerText = "There is no user with Id " + id.value;
            }

        }
    })
})();