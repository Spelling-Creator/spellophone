// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare var RuntimeExports: {
    FS: {
        root: null;
        mounts: never[];
        devices: {};
        streams: never[];
        nextInode: number;
        nameTable: never[];
        currentPath: string;
        initialized: boolean;
        ignorePermissions: boolean;
        filesystems: null;
        syncFSRequests: number;
        ErrnoError: {
            new (errno: any): {
                name: string;
                errno: any;
            };
        };
        FSStream: {
            new (): {
                shared: {};
                get object(): any;
                set object(val: any);
                node: any;
                get isRead(): boolean;
                get isWrite(): boolean;
                get isAppend(): number;
                flags: any;
                position: any;
            };
        };
        FSNode: {
            new (parent: any, name: any, mode: any, rdev: any): {
                node_ops: {};
                stream_ops: {};
                readMode: number;
                writeMode: number;
                mounted: null;
                parent: any;
                mount: any;
                id: number;
                name: any;
                mode: any;
                rdev: any;
                atime: number;
                mtime: number;
                ctime: number;
                get read(): boolean;
                set read(val: boolean);
                get write(): boolean;
                set write(val: boolean);
                readonly isFolder: any;
                readonly isDevice: any;
                addListener(cb: any, exclusive?: boolean): {
                    listeners: any;
                    entry: {
                        cb: any;
                        exclusive: boolean;
                    };
                };
                notifyListeners(flags: any): void;
                exclTurn: any;
            };
        };
        lookupPath(path: any, opts?: {}): {
            path: string;
            node?: undefined;
        } | {
            path: string;
            node: any;
        };
        getPath(node: any): any;
        hashName(parentid: any, name: any): number;
        hashAddNode(node: any): void;
        hashRemoveNode(node: any): void;
        lookupNode(parent: any, name: any): any;
        createNode(parent: any, name: any, mode: any, rdev?: undefined): any;
        destroyNode(node: any): void;
        isRoot(node: any): boolean;
        isMountpoint(node: any): boolean;
        isFile(mode: any): boolean;
        isDir(mode: any): boolean;
        isLink(mode: any): boolean;
        isChrdev(mode: any): boolean;
        isBlkdev(mode: any): boolean;
        isFIFO(mode: any): boolean;
        isSocket(mode: any): boolean;
        flagsToPermissionString(flag: any): string;
        nodePermissions(node: any, perms: any): 0 | 2;
        mayLookup(dir: any): any;
        mayCreate(dir: any, name: any): any;
        mayDelete(dir: any, name: any, isdir: any): any;
        mayOpen(node: any, flags: any): any;
        checkOpExists(op: any, err: any): any;
        MAX_OPEN_FDS: number;
        nextfd(): number;
        getStreamChecked(fd: any): any;
        getStream: (fd: any) => any;
        createStream(stream: any, fd?: number): any;
        closeStream(fd: any): void;
        dupStream(origStream: any, fd?: number): any;
        doSetAttr(stream: any, node: any, attr: any): void;
        chrdev_stream_ops: {
            open(stream: any): void;
            llseek(): never;
        };
        major: (dev: any) => number;
        minor: (dev: any) => number;
        makedev: (ma: any, mi: any) => number;
        registerDevice(dev: any, ops: any): void;
        getDevice: (dev: any) => any;
        getMounts(mount: any): any[];
        syncfs(populate: any, callback: any): void;
        mount(type: any, opts: any, mountpoint: any): any;
        unmount(mountpoint: any): void;
        lookup(parent: any, name: any): any;
        mknod(path: any, mode: any, dev: any): any;
        statfs(path: any): any;
        statfsStream(stream: any): any;
        statfsNode(node: any): {
            bsize: number;
            frsize: number;
            blocks: number;
            bfree: number;
            bavail: number;
            files: any;
            ffree: number;
            fsid: number;
            flags: number;
            namelen: number;
        };
        create(path: any, mode?: number): any;
        mkdir(path: any, mode?: number): any;
        mkdirTree(path: any, mode?: number): void;
        mkdev(path: any, mode: any, dev?: undefined): any;
        symlink(oldpath: any, newpath: any): any;
        link(oldpath: any, newpath: any, flags: any): any;
        rename(old_path: any, new_path: any): void;
        rmdir(path: any): void;
        readdir(path: any): any;
        unlink(path: any): void;
        readlink(path: any): any;
        stat(path: any, dontFollow?: boolean): any;
        fstat(fd: any): any;
        lstat(path: any): any;
        doChmod(stream: any, node: any, mode: any, dontFollow?: boolean): void;
        chmod(path: any, mode: any, dontFollow?: boolean): void;
        lchmod(path: any, mode: any): void;
        fchmod(fd: any, mode: any): void;
        doChown(stream: any, node: any, dontFollow?: boolean): void;
        chown(path: any, uid: any, gid: any, dontFollow?: boolean): void;
        lchown(path: any, uid: any, gid: any): void;
        fchown(fd: any, uid: any, gid: any): void;
        doTruncate(stream: any, node: any, len: any): void;
        truncate(path: any, len: any): void;
        ftruncate(fd: any, len: any): void;
        utime(path: any, atime: any, mtime: any, dontFollow?: boolean): void;
        open(path: any, flags: any, mode?: number): any;
        close(stream: any): void;
        isClosed(stream: any): boolean;
        llseek(stream: any, offset: any, whence: any): any;
        read(stream: any, buffer: any, offset: any, length: any, position?: undefined): any;
        write(stream: any, buffer: any, offset: any, length: any, position?: undefined, canOwn?: undefined): any;
        mmap(stream: any, length: any, position: any, prot: any, flags: any): any;
        msync(stream: any, buffer: any, offset: any, length: any, mmapFlags: any): any;
        ioctl(stream: any, cmd: any, arg: any): any;
        readFile(path: any, opts?: {}): Uint8Array<any>;
        writeFile(path: any, data: any, opts?: {}): void;
        cwd: () => any;
        chdir(path: any): void;
        createDefaultDirectories(): void;
        createDefaultDevices(): void;
        createSpecialDirectories(): void;
        createStandardStreams(input: any, output: any, error: any): void;
        staticInit(): void;
        init(input?: undefined, output?: undefined, error?: undefined): void;
        quit(): void;
        analyzePath(path: any, dontResolveLastLink?: boolean): {
            isRoot: boolean;
            exists: boolean;
            error: number;
            name: null;
            path: null;
            object: null;
            parentExists: boolean;
            parentPath: null;
            parentObject: null;
        };
        createPath(parent: any, path: any, canRead?: undefined, canWrite?: undefined): any;
        createFile(parent: any, name: any, properties: any, canRead?: undefined, canWrite?: undefined): any;
        createDataFile(parent: any, name: any, data?: undefined, canRead?: undefined, canWrite?: undefined, canOwn?: undefined): void;
        createDevice(parent: any, name: any, input?: undefined, output?: undefined): any;
        forceLoadFile(obj: any): true | undefined;
        createLazyFile(parent: any, name: any, url: any, canRead?: undefined, canWrite?: undefined): any;
    };
    NODEFS: {
        isWindows: boolean;
        staticInit(): void;
        convertNodeCode(e: any): any;
        tryFSOperation(f: any): any;
        mount(mount: any): any;
        createNode(parent: any, name: any, mode: any, dev?: undefined): any;
        getMode(path: any): any;
        realPath(node: any): any;
        flagsForNode(flags: any): number;
        doGetAttr(func: any, node: any): {
            dev: any;
            ino: any;
            mode: any;
            nlink: any;
            uid: any;
            gid: any;
            rdev: any;
            size: any;
            atime: any;
            mtime: any;
            ctime: any;
            atimeMs: any;
            mtimeMs: any;
            ctimeMs: any;
            blksize: any;
            blocks: any;
        };
        doSetAttr(arg: any, node: any, attr: any, chmod: any, utimes: any, truncate: any, stat: any): void;
        node_ops: {
            getattr(node: any): any;
            setattr(node: any, attr: any): void;
            lookup(parent: any, name: any): any;
            mknod(parent: any, name: any, mode: any, dev?: undefined): any;
            rename(oldNode: any, newDir: any, newName: any): void;
            unlink(parent: any, name: any): void;
            rmdir(parent: any, name: any): void;
            readdir(node: any): any;
            symlink(parent: any, newName: any, oldPath: any): void;
            readlink(node: any): any;
            statfs(path: any): any;
        };
        stream_ops: {
            getattr(stream: any): any;
            setattr(stream: any, attr: any): void;
            open(stream: any): void;
            close(stream: any): void;
            dup(stream: any): void;
            read(stream: any, buffer: any, offset: any, length: any, position: any): any;
            write(stream: any, buffer: any, offset: any, length: any, position: any): any;
            llseek(stream: any, offset: any, whence: any): any;
            mmap(stream: any, length: any, position: any, prot: any, flags: any): {
                ptr: any;
                allocated: boolean;
            };
            msync(stream: any, buffer: any, offset: any, length: any, mmapFlags: any): number;
        };
    };
    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index.
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */
    UTF8ToString: (ptr: number, maxBytesToRead?: number | undefined, ignoreNul?: boolean | undefined) => string;
    stringToUTF8: (str: any, outPtr: any, maxBytesToWrite: any) => any;
    lengthBytesUTF8: (str: any) => number;
    /** @type {!Uint8Array} */
    HEAPU8: Uint8Array;
    /** @type {!Int16Array} */
    HEAP16: Int16Array;
    /** @type {!Int32Array} */
    HEAP32: Int32Array;
    FS_createPath: (...args: any[]) => any;
    FS_createDataFile: (...args: any[]) => any;
    FS_preloadFile: (parent: any, name: any, url: any, canRead: any, canWrite: any, dontCreateFile: any, canOwn: any, preFinish: any) => Promise<void>;
    FS_unlink: (...args: any[]) => any;
    FS_createLazyFile: (...args: any[]) => any;
    FS_createDevice: (...args: any[]) => any;
    addRunDependency: (id: any) => void;
    removeRunDependency: (id: any) => void;
};
interface WasmModule {
  _sp_initialize(_0: number, _1: number): number;
  _sp_sample_rate_get(): number;
  _sp_terminate(): void;
  _free(_0: number): void;
  _sp_version(): number;
  _sp_synthesize(_0: number, _1: number): number;
  _sp_audio_data(): number;
  _sp_audio_samples(): number;
  _sp_events_data(): number;
  _sp_events_count(): number;
  _sp_event_size(): number;
  _sp_strings_data(): number;
  _sp_text_to_phonemes(_0: number, _1: number): number;
  _sp_voice_count(): number;
  _sp_voice_name(_0: number): number;
  _sp_voice_identifier(_0: number): number;
  _sp_voice_languages(_0: number): number;
  _sp_voice_gender(_0: number): number;
  _sp_voice_age(_0: number): number;
  _sp_set_voice_by_name(_0: number): number;
  _sp_set_voice_by_properties(_0: number, _1: number, _2: number, _3: number, _4: number): number;
  _sp_current_voice_name(): number;
  _sp_current_voice_languages(): number;
  _sp_dictionary_name(): number;
  _sp_dictionary_loaded(): number;
  _sp_set_parameter(_0: number, _1: number, _2: number): number;
  _sp_get_parameter(_0: number, _1: number): number;
  _sp_set_punctuation_list(_0: number): number;
  _malloc(_0: number): number;
}

export type MainModule = WasmModule & typeof RuntimeExports;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
