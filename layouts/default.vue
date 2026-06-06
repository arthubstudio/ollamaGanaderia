<template>

  <div
    class="min-h-screen bg-gray-100 flex"
  >

    <!-- SIDEBAR -->

    <aside
      class="w-72 bg-white border-r border-gray-200 flex flex-col"
    >

      <!-- LOGO -->

      <div
        class="p-6 border-b border-gray-200"
      >

        <h1
          class="text-3xl font-bold"
        >
          Ganadería IA
        </h1>

        <p
          class="text-gray-500 text-sm mt-1"
        >
          Sistema inteligente ganadero
        </p>

      </div>



      <!-- NAVIGATION -->

      <nav
        class="flex-1 p-4 space-y-2"
      >

        <NuxtLink
          to="/"
          class="block px-4 py-3 rounded-xl hover:bg-gray-100 transition"
        >
          Dashboard
        </NuxtLink>



        <NuxtLink
          to="/vacas"
          class="block px-4 py-3 rounded-xl hover:bg-gray-100 transition"
        >
          Vacas
        </NuxtLink>



        <NuxtLink
          to="/ia"
          class="block px-4 py-3 rounded-xl hover:bg-gray-100 transition"
        >
          IA Ganadera
        </NuxtLink>

      </nav>



      <!-- FOOTER -->

      <div
        class="p-4 border-t border-gray-200 text-sm text-gray-500"
      >
        Offline AI Ranch System
      </div>

    </aside>



    <!-- MAIN -->

    <div
      class="flex-1 flex flex-col"
    >

      <!-- TOPBAR -->

      <header
        class="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8"
      >

        <div>

          <h2
            class="text-2xl font-bold"
          >
            Panel Principal
          </h2>

        </div>



        <div
          class="flex items-center gap-4"
        >

          <div
            class="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold"
          >
            A
          </div>

        </div>

      </header>



      <!-- PAGE -->

      <main
        class="flex-1 p-8 overflow-auto"
      >

        <slot />

      </main>

    </div>

  </div>

</template>