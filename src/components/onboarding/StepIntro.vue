<template>
    <section>
        <h1>Meet your Self Companion</h1>
        <div class="boxes">
            <div class="box">
                <div class="box-left">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                        <path
                            d="M2 6.342a3.375 3.375 0 0 1 6-2.088 3.375 3.375 0 0 1 5.997 2.26c-.063 2.134-1.618 3.76-2.955 4.784a14.437 14.437 0 0 1-2.676 1.61c-.02.01-.038.017-.05.022l-.014.006-.004.002h-.002a.75.75 0 0 1-.592.001h-.002l-.004-.003-.015-.006a5.528 5.528 0 0 1-.232-.107 14.395 14.395 0 0 1-2.535-1.557C3.564 10.22 1.999 8.558 1.999 6.38L2 6.342Z" />
                    </svg>
                </div>
                <div class="box-right">
                    <h2>Not a tool</h2>
                    <p>just a companion</p>
                </div>
            </div>

            <div class="box">
                <div class="box-left">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                        <path fill-rule="evenodd"
                            d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                            clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="box-right">
                    <h2>No tracking</h2>
                    <p>everything stays with you</p>
                </div>
            </div>

            <div class="box">
                <div class="box-left">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                        <path fill-rule="evenodd"
                            d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM6 8c.552 0 1-.672 1-1.5S6.552 5 6 5s-1 .672-1 1.5S5.448 8 6 8Zm5-1.5c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5Zm.005 4.245a.75.75 0 0 0-1.06 0 2.75 2.75 0 0 1-3.89 0 .75.75 0 0 0-1.06 1.06 4.25 4.25 0 0 0 6.01 0 .75.75 0 0 0 0-1.06Z"
                            clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="box-right">
                    <h2>Shaped by you</h2>
                    <p>as you see yourself</p>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
h1 {
    margin: 1rem 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-strong);
}

h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-strong);
}

.boxes {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 2rem 2rem;
}

.box {
    padding: 2rem;
    border-radius: 1rem;
    background: linear-gradient(to right, var(--secondary), transparent);
    display: flex;
    gap: 2rem;
}

.box-left {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
}

.box-left svg {
    width: 3rem;
    height: 3rem;
    fill: var(--darker);
}

.box-right {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.box-right p {
    margin: 0;
    padding: 0.2rem 0;
}
</style>
