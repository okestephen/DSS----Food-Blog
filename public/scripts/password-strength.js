const passwordInput = document.getElementById("password");
                    const message = document.getElementById("strength-message");

                    passwordInput.addEventListener("input", () => {
                        const val = passwordInput.value;
                        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
                        let strength = 0;
                        if (val.length >= 8) strength++;
                        if (/[a-z]/.test(val)) strength++;
                        if (/[A-Z]/.test(val)) strength++;
                        if (/\d/.test(val)) strength++;
                        if (/[\W_]/.test(val)) strength++;

                        switch (strength) {
                            case 0:
                            case 1:
                            case 2:
                                message.textContent = "Weak"; 
                                // message.style.color = "red"
                                message.classList.add("msg")
                                message.classList.remove("warning")
                                message.classList.add("error");
                                break;
                            case 3:
                            case 4:
                                message.textContent = "Moderate";
                                // message.style.color = "orange";
                                message.classList.remove("success")
                                message.classList.add("warning");

                                break;
                            case 5:
                                message.textContent = "Strong";
                                // message.style.color = "green";
                                message.classList.add("success")
                                break;
                        }
                    });
